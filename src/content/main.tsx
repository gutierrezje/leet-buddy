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
import {
  SubmissionStatus,
  PathInfo,
  CurrentProblem,
  ProblemMetadataMessage,
  SubmissionAcceptedMessage,
  ProblemClearedMessage,
} from '@/shared/types';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import SidebarLauncher from './views/SidebarLauncher';
import { createLogger } from '@/shared/utils/debug';

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

function detectSubmissionResult() {
  const { problemSlug, submissionId } = parsePath();
  if (!submissionId) return;

  const status = readSubmissionStatus();
  if (status !== 'Accepted') return;

  const key = `${problemSlug}#${submissionId}`;
  if (emittedSubmissionKeys.has(key)) return;
  emittedSubmissionKeys.add(key);

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

function safeSend(msg: unknown) {
  try {
    if (!chrome?.runtime?.id) return;
    chrome.runtime.sendMessage(msg, () => void chrome.runtime.lastError);
  } catch (e) {
    debug('Failed to send message: %O', e);
  }
}

function persistCurrentProblem(problem: CurrentProblem) {
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
      chrome.storage.local.remove(
        'currentProblem',
        () => void chrome.runtime.lastError
      );

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
