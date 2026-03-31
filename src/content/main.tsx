/**
 * Content script for LeetCode problem detection and messaging.
 *
 * TODO (Technical Debt): Extract testable navigation logic
 * This file has side effects on import and doesn't export functions,
 * making it difficult to test directly. Consider refactoring:
 * 1. Extract to src/content/navigationLogic.ts:
 *    - computeSlugTransition(), shouldClearCache(), buildMessage()
 * 2. Test pure functions directly
 * 3. Keep this file as thin orchestration
 * See src/test/README.md for details.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type {
  CodeSnapshotMessage,
  CurrentCodeSnapshot,
  CurrentProblem,
  PathInfo,
  ProblemClearedMessage,
  ProblemMetadataMessage,
  SubmissionAcceptedMessage,
  SubmissionStatus,
} from '@/shared/types';
import { createLogger } from '@/shared/utils/debug';
import SidebarLauncher from './views/SidebarLauncher';

const debug = createLogger('content');

debug('Content script loaded');

function domTitle(): string {
  return (document.title || '').replace(/\s+-\s+LeetCode\s*$/i, '').trim();
}

function parsePath(path: string = location.pathname): PathInfo {
  // /problems/<slug>
  const slugMatch = path.match(/\/problems\/([^/]+)/);
  const problemSlug = slugMatch?.[1] ?? '';

  // /submissions/<id>
  const subMatch = path.match(/\/submissions\/(\d+)/);
  const submissionId = subMatch?.[1] || '';

  return { problemSlug, submissionId };
}

function readSubmissionStatus(): SubmissionStatus | null {
  const span = document.querySelector(
    'span[data-e2e-locator="submission-result"]'
  );
  const text = span?.textContent?.trim().toLowerCase();
  if (!text) return null;
  if (text.includes('accepted')) return 'Accepted';
  return 'Failed';
}

const emittedSubmissionKeys = new Set<string>();
const lastCodeSnapshotFingerprintBySlug: Record<string, string> = {};
const monacoSnapshotSeenBySlug: Record<string, boolean> = {};
let latestPageMonacoSnapshot: CurrentCodeSnapshot | null = null;

const MAX_CODE_SNAPSHOT_CHARS = 120_000;
const PAGE_BRIDGE_SOURCE = 'LEETBUDDY_PAGE_BRIDGE';
const PAGE_MONACO_REQUEST = 'LEETBUDDY_MONACO_REQUEST';
const PAGE_MONACO_RESPONSE = 'LEETBUDDY_MONACO_RESPONSE';
const PAGE_SNAPSHOT_STALE_AFTER_MS = 5000;

function normalizeCode(value: string): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/\u200b/g, '')
    .replace(/\r\n/g, '\n')
    .trim();
}

function simpleHash(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

function requestPageMonacoSnapshot(slug: string) {
  window.postMessage(
    {
      source: PAGE_BRIDGE_SOURCE,
      type: PAGE_MONACO_REQUEST,
      slug,
    },
    '*'
  );
}

function handlePageBridgeMessage(event: MessageEvent) {
  if (event.source !== window) return;
  const data = event.data as
    | {
        source?: string;
        type?: string;
        slug?: string;
        code?: string;
        language?: string;
        at?: number;
      }
    | undefined;

  if (!data) return;
  if (data.source !== PAGE_BRIDGE_SOURCE) return;
  if (data.type !== PAGE_MONACO_RESPONSE) return;
  if (typeof data.slug !== 'string') return;
  if (typeof data.code !== 'string') return;

  const normalized = normalizeCode(data.code);
  if (!normalized) return;

  latestPageMonacoSnapshot = {
    slug: data.slug,
    code: normalized.slice(0, MAX_CODE_SNAPSHOT_CHARS),
    source: 'monaco',
    language: typeof data.language === 'string' ? data.language : undefined,
    at: typeof data.at === 'number' ? data.at : Date.now(),
  };
}

function getRecentPageMonacoSnapshot(slug: string): CurrentCodeSnapshot | null {
  if (!latestPageMonacoSnapshot) return null;
  if (latestPageMonacoSnapshot.slug !== slug) return null;
  if (Date.now() - latestPageMonacoSnapshot.at > PAGE_SNAPSHOT_STALE_AFTER_MS) {
    return null;
  }
  return latestPageMonacoSnapshot;
}

function extractCodeSnapshot(slug: string): CurrentCodeSnapshot | null {
  type MonacoModelLike = {
    getValue?: () => string;
    getLanguageId?: () => string;
  };

  type MonacoGlobal = {
    editor?: {
      getModels?: () => MonacoModelLike[];
    };
  };

  const windowWithMonaco = window as unknown as { monaco?: MonacoGlobal };
  const monacoModels = windowWithMonaco.monaco?.editor?.getModels?.();
  if (monacoModels?.length) {
    const primary = monacoModels[0];
    const code = normalizeCode(primary.getValue?.() || '');
    if (code) {
      return {
        slug,
        code: code.slice(0, MAX_CODE_SNAPSHOT_CHARS),
        source: 'monaco',
        language: primary.getLanguageId?.(),
        at: Date.now(),
      };
    }
  }

  const textarea = document.querySelector<HTMLTextAreaElement>(
    'textarea.inputarea, textarea[data-mode-id], textarea[aria-label*="editor" i], textarea[aria-label*="code" i]'
  );
  if (textarea) {
    const code = normalizeCode(textarea.value || textarea.textContent || '');
    if (code) {
      return {
        slug,
        code: code.slice(0, MAX_CODE_SNAPSHOT_CHARS),
        source: 'textarea',
        at: Date.now(),
      };
    }
  }

  const viewLines = Array.from(
    document.querySelectorAll<HTMLElement>(
      '.monaco-editor .view-lines .view-line'
    )
  )
    .map((line) => line.textContent || '')
    .join('\n');
  const viewLinesCode = normalizeCode(viewLines);
  if (viewLinesCode) {
    return {
      slug,
      code: viewLinesCode.slice(0, MAX_CODE_SNAPSHOT_CHARS),
      source: 'view-lines',
      at: Date.now(),
    };
  }

  const preCode = document.querySelector('pre code');
  const preCodeText = normalizeCode(preCode?.textContent || '');
  if (preCodeText) {
    return {
      slug,
      code: preCodeText.slice(0, MAX_CODE_SNAPSHOT_CHARS),
      source: 'pre-code',
      at: Date.now(),
    };
  }

  return null;
}

function persistCurrentCodeSnapshot(snapshot: CurrentCodeSnapshot) {
  if (!isExtensionContextValid()) return;
  try {
    chrome.storage.local.set(
      {
        currentCodeSnapshot: snapshot,
      },
      () => void chrome.runtime.lastError
    );
  } catch (e) {
    debug('Failed to persist code snapshot: %O', e);
  }
}

function detectCodeSnapshot() {
  const slug = parseSlug();
  if (!slug) return;

  requestPageMonacoSnapshot(slug);

  const snapshot =
    getRecentPageMonacoSnapshot(slug) || extractCodeSnapshot(slug);
  if (!snapshot) return;

  if (snapshot.source !== 'monaco' && monacoSnapshotSeenBySlug[slug]) {
    return;
  }

  if (snapshot.source === 'monaco') {
    monacoSnapshotSeenBySlug[slug] = true;
  }

  const fingerprint = `${snapshot.language || ''}:${snapshot.code.length}:${simpleHash(snapshot.code)}`;
  if (lastCodeSnapshotFingerprintBySlug[slug] === fingerprint) return;
  lastCodeSnapshotFingerprintBySlug[slug] = fingerprint;

  const msg: CodeSnapshotMessage = {
    type: 'CODE_SNAPSHOT',
    ...snapshot,
  };

  safeSend(msg);
  persistCurrentCodeSnapshot(snapshot);
}

function handleCodeCaptureRequest(
  changes: Record<string, chrome.storage.StorageChange>,
  area: string
) {
  if (area !== 'local') return;
  if (typeof changes.codeSnapshotRequestNonce?.newValue !== 'number') return;
  detectCodeSnapshot();
}

function detectSubmissionResult() {
  const { problemSlug, submissionId } = parsePath();
  if (!submissionId) return;

  const status = readSubmissionStatus();
  if (status !== 'Accepted') return;

  const key = `${problemSlug}#${submissionId}`;
  if (emittedSubmissionKeys.has(key)) return;
  emittedSubmissionKeys.add(key);

  // Capture code once when an accepted submission is detected.
  detectCodeSnapshot();

  const msg: SubmissionAcceptedMessage = {
    type: 'SUBMISSION_ACCEPTED',
    slug: problemSlug,
    submissionId,
    at: Date.now(),
  };
  safeSend(msg);
}

function parseSlug(path: string = location.pathname): string {
  const parts = path.split('/').filter(Boolean);
  const i = parts.indexOf('problems');
  return i !== -1 && parts[i + 1] ? parts[i + 1] : '';
}

function getCSRFToken(): string {
  return document.cookie.match(/csrftoken=([^;]+)/)?.[1] || '';
}

const cache: Record<string, CurrentProblem> = {};
let currentSlug: string | null = null;
let inFlightAbort: AbortController | null = null;
let lastEmittedSlug: string | null = null;

function isExtensionContextValid(): boolean {
  try {
    return !!chrome?.runtime?.id;
  } catch {
    return false;
  }
}

function safeSend(msg: unknown) {
  if (!isExtensionContextValid()) return;
  try {
    chrome.runtime.sendMessage(msg, () => void chrome.runtime.lastError);
  } catch (e) {
    debug('Failed to send message: %O', e);
  }
}

function persistCurrentProblem(problem: CurrentProblem) {
  if (!isExtensionContextValid()) return;
  try {
    chrome.storage.local.get(['currentProblem'], (data) => {
      const existing: CurrentProblem | null = data.currentProblem || null;

      const startAt =
        existing?.slug === problem.slug ? existing.startAt : Date.now();

      chrome.storage.local.set(
        {
          currentProblem: {
            ...problem,
            startAt,
          },
        },
        () => void chrome.runtime.lastError
      );
    });
  } catch (e) {
    debug('Failed to persist current problem: %O', e);
  }
}

async function fetchMeta(
  slug: string,
  signal: AbortSignal
): Promise<CurrentProblem | null> {
  const query = `
    query q($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        title
        difficulty
        isPaidOnly
        topicTags { name slug }
      }
    }`;
  try {
    const res = await fetch('https://leetcode.com/graphql/', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        'x-csrftoken': getCSRFToken(),
      },
      body: JSON.stringify({ query, variables: { titleSlug: slug } }),
      signal,
    });
    if (!res.ok) return null;
    const json = await res.json();
    const q = json?.data?.question as Record<string, unknown> | undefined;
    if (!q) return null;
    const topicTags = q.topicTags as Array<{ name: string }>;
    return {
      slug,
      title: q.title as string,
      difficulty: q.difficulty as string,
      tags: topicTags.map((t) => t.name),
    };
  } catch (e) {
    if ((e as { name?: string }).name !== 'AbortError') {
      debug('Fetch failed: %O', e);
    }
    return null;
  }
}

async function handleSlugChange() {
  const slug = parseSlug();

  // Handle navigation away from problem page
  if (!slug) {
    if (currentSlug !== null) {
      debug('Left problem page, clearing state');
      currentSlug = null;
      // Keep lastEmittedSlug to detect re-entry later

      // Clear storage
      if (isExtensionContextValid()) {
        try {
          chrome.storage.local.remove(
            'currentProblem',
            () => void chrome.runtime.lastError
          );
          chrome.storage.local.remove(
            'currentCodeSnapshot',
            () => void chrome.runtime.lastError
          );
        } catch (e) {
          debug('Failed to clear storage: %O', e);
        }
      }

      // Notify sidepanel to clear stale state
      const msg: ProblemClearedMessage = { type: 'PROBLEM_CLEARED' };
      safeSend(msg);
    }
    return;
  }

  // Check for re-entry: returning to a problem after leaving (currentSlug was null)
  const isReEntry = currentSlug === null && slug === lastEmittedSlug;

  // Skip if still on same problem (no change) - prevents repeated fetches on DOM mutations
  if (slug === currentSlug) {
    return;
  }

  if (isReEntry) {
    debug('Re-entering problem %s, forcing refresh', slug);
    // Clear cache to force fresh fetch
    delete cache[slug];
  }

  currentSlug = slug;

  // Abort previous fetch (if any)
  if (inFlightAbort) inFlightAbort.abort();
  inFlightAbort = new AbortController();

  // Serve from cache fast (unless re-entry)
  if (cache[slug] && !isReEntry) {
    const problem = cache[slug];

    // Update startAt if new session
    if (!problem.startAt) {
      problem.startAt = Date.now();
    }
    const msg: ProblemMetadataMessage = {
      type: 'PROBLEM_METADATA',
      ...problem,
    };
    safeSend(msg);
    persistCurrentProblem(problem);
    lastEmittedSlug = slug;
    return;
  }

  // Fetch once (or refresh on re-entry)
  const problem = await fetchMeta(slug, inFlightAbort.signal);
  if (slug !== currentSlug) return; // navigated away during fetch

  if (problem) {
    cache[slug] = problem;
  }

  const finalProblem: CurrentProblem = problem || {
    slug,
    // Fallback (DOM or slug)
    title: domTitle() || slug,
    difficulty: 'Unknown',
    tags: ['Unknown'],
    startAt: Date.now(),
  };

  const msg: ProblemMetadataMessage = {
    type: 'PROBLEM_METADATA',
    ...finalProblem,
  };
  safeSend(msg);
  persistCurrentProblem(finalProblem);
  lastEmittedSlug = slug;
}

function cycle() {
  handleSlugChange();
  detectSubmissionResult();
}

let debounceTimer: number | undefined;
function debounced() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(cycle, 120);
}

window.addEventListener('message', handlePageBridgeMessage);
chrome.storage.onChanged.addListener(handleCodeCaptureRequest);
cycle();
new MutationObserver(debounced).observe(document.body, {
  childList: true,
  subtree: true,
});

// Inject a button to open the side panel
const container = document.createElement('div');
container.id = 'crxjs-app';
document.body.appendChild(container);
createRoot(container).render(
  <StrictMode>
    <SidebarLauncher />
  </StrictMode>
);
