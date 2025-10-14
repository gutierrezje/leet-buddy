import { SubmissionRecord } from '@/shared/types';

const PREFIX = 'submissions::';

function keyFor(slug: string) {
  return `${PREFIX}${slug}`;
}

export function saveSubmission(
  slug: string,
  rec: SubmissionRecord
) {
  const key = keyFor(slug);

  chrome.storage.local.set({ [key]: rec }, () => void chrome.runtime.lastError);
}

export function getSubmission(
  slug: string
): Promise<SubmissionRecord | null> {
  const key = keyFor(slug);
  return new Promise(resolve => {
    chrome.storage.local.get([key], data => {
      resolve(data[key] || null);
    });
  });
}

export async function getAllSubmissions(): Promise<
  Record<string, SubmissionRecord>
> {
  return new Promise((resolve) => {
    chrome.storage.local.get(null, items => {
      const out: Record<string, SubmissionRecord> = {};
      for (const [k, v] of Object.entries(items)) {
        if (k.startsWith(PREFIX)) {
          const slug = k.slice(PREFIX.length);
          out[slug] = v as SubmissionRecord;
        }
      }
      resolve(out);
    });
  });
}

export function clearSubmissions(slug?: string) {
  if (!slug) {
    // clear all problem submissions
    chrome.storage.local.get(null, (items) => {
      const keys = Object.keys(items).filter((k) => k.startsWith(PREFIX));
      if (keys.length) {
        chrome.storage.local.remove(keys, () => void chrome.runtime.lastError);
      }
    });
    return;
  }
  chrome.storage.local.remove(
    [keyFor(slug)],
    () => void chrome.runtime.lastError
  );
}
