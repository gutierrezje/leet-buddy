import { SubmissionStatus, PathInfo, ProblemMeta } from '@/shared/submitting';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import SidebarLauncher from './views/SidebarLauncher';

console.log('[LeetBuddy] Content script loaded');

function domTitle(): string {
  return (document.title || '').replace(/\s+-\s+LeetCode\s*$/i, '').trim();
}

function parsePath(path: string = location.pathname): PathInfo {
  // /problems/<slug>
  const slugMatch = path.match(/\/problems\/([^/]+)/);
  const problemSlug = slugMatch?.[1] ?? '';

  // /submissions/<id>
  const subMatch = path.match(/\/submissions\/(\d+)/);
  const submissionId = subMatch?.[1];

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
  if (!problemSlug || !submissionId) return;

  const status = readSubmissionStatus();
  if (!status) return;

  const key = `${problemSlug}#${submissionId}`;
  if (emittedSubmissionKeys.has(key)) return;
  emittedSubmissionKeys.add(key);

  safeSend({
    type: 'PROBLEM_SUBMISSION_RESULT',
    slug: problemSlug,
    submissionId,
    status,
    at: Date.now(),
  });
}

function parseSlug(path: string = location.pathname): string {
  const parts = path.split('/').filter(Boolean);
  const i = parts.indexOf('problems');
  return i !== -1 && parts[i + 1] ? parts[i + 1] : '';
}

function getCSRFToken(): string {
  return document.cookie.match(/csrftoken=([^;]+)/)?.[1] || '';
}

const cache: Record<string, ProblemMeta> = {};
let currentSlug: string | null = null;
let inFlightAbort: AbortController | null = null;

function safeSend(msg: any) {
  try {
    if (!chrome?.runtime?.id) return;
    chrome.runtime.sendMessage(msg, () => void chrome.runtime.lastError);
  } catch {}
}

function persistCurrentProblem(payload: {
  slug: string;
  title: string;
  difficulty: string;
  isPaidOnly: boolean;
  tags: string[];
}) {
  chrome.storage.local.set(
    { currentProblem: payload },
    () => void chrome.runtime.lastError
  );
}

async function fetchMeta(
  slug: string,
  signal: AbortSignal
): Promise<ProblemMeta | null> {
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
    const q = json?.data?.question;
    if (!q) return null;
    return {
      title: q.title,
      difficulty: q.difficulty,
      isPaidOnly: q.isPaidOnly,
      tags: q.topicTags.map((t: any) => t.name),
    };
  } catch (e) {
    if ((e as any).name !== 'AbortError') {
      console.warn('[LeetBuddy] fetch failed', e);
    }
    return null;
  }
}

async function handleSlugChange() {
  const slug = parseSlug();
  if (!slug || slug === currentSlug) return;
  currentSlug = slug;

  // Abort previous fetch (if any)
  if (inFlightAbort) inFlightAbort.abort();
  inFlightAbort = new AbortController();

  // Serve from cache fast
  if (cache[slug]) {
    const meta = cache[slug];
    const msg = { type: 'PROBLEM_METADATA', slug, ...meta };
    safeSend(msg);
    persistCurrentProblem(msg);
    return;
  }

  // Fetch once
  const meta = await fetchMeta(slug, inFlightAbort.signal);
  if (slug !== currentSlug) return; // navigated away during fetch

  const finalMeta: ProblemMeta = meta || {
    // Fallback (DOM or slug)
    title: domTitle() || slug,
    difficulty: '',
    isPaidOnly: false,
    tags: [],
  };

  cache[slug] = finalMeta;
  const msg = { type: 'PROBLEM_METADATA', slug, ...finalMeta };
  safeSend(msg);
  persistCurrentProblem(msg);
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

chrome.runtime.onMessage.addListener((req, _s, send) => {
  if (req.type === 'GET_CURRENT_PROBLEM') {
    chrome.storage.local.get(['currentProblem'], (d) =>
      send(d.currentProblem || null)
    );
    return true;
  }
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
