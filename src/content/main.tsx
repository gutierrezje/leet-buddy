import { SubmissionStatus, PathInfo, CurrentProblem } from '@/shared/types';
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
  console.log('Detected accepted submission:', key);
  console.log('Emitted submissions so far:', emittedSubmissionKeys);
  if (emittedSubmissionKeys.has(key)) return;
  emittedSubmissionKeys.add(key);
  console.log('Emitting submission accepted event for key:', key);

  safeSend({
    type: 'SUBMISSION_ACCEPTED',
    slug: problemSlug,
    submissionId,
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

const cache: Record<string, CurrentProblem> = {};
let currentSlug: string | null = null;
let inFlightAbort: AbortController | null = null;

function safeSend(msg: any) {
  try {
    if (!chrome?.runtime?.id) return;
    chrome.runtime.sendMessage(msg, () => void chrome.runtime.lastError);
  } catch {}
}

function persistCurrentProblem(problem: CurrentProblem) {
  chrome.storage.local.get(['currentProblem'], data => {
    const existing: CurrentProblem | null = data.currentProblem || null;

    const startAt = existing?.slug === problem.slug
      ? existing.startAt
      : Date.now();

    chrome.storage.local.set(
      {
        currentProblem: {
          ...problem,
          startAt
        }
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
    const q = json?.data?.question;
    if (!q) return null;
    return {
      slug,
      title: q.title,
      difficulty: q.difficulty,
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
    const problem = cache[slug];

    // Update startAt if new session
    if (!problem.startAt) {
      problem.startAt = Date.now();
    }
    const msg = { type: 'PROBLEM_METADATA', ...problem };
    safeSend(msg);
    persistCurrentProblem(problem);
    return;
  }

  // Fetch once
  const problem = await fetchMeta(slug, inFlightAbort.signal);
  if (slug !== currentSlug) return; // navigated away during fetch

  if (problem) {
    cache[slug] = problem;
  }

  const finalProblem: CurrentProblem = problem || {
    slug,
    // Fallback (DOM or slug)
    title: domTitle() || slug,
    difficulty: '',
    tags: [],
    startAt: Date.now(),
  };

  const msg = { type: 'PROBLEM_METADATA', ...finalProblem };
  safeSend(msg);
  persistCurrentProblem(finalProblem);
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
