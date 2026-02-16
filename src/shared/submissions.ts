import { SubmissionRecord } from '@/shared/types';

const PREFIX = 'submissions::';
const SCHEMA_VERSION_KEY = 'submissions_schema_version';
const CURRENT_SCHEMA_VERSION = 2;

// Per-slug write queue to prevent concurrent write conflicts
const writeQueues = new Map<string, Promise<void>>();

function keyFor(slug: string) {
  return `${PREFIX}${slug}`;
}

/**
 * Serializes writes to the same slug to prevent race conditions
 */
async function withWriteLock<T>(
  slug: string,
  operation: () => Promise<T>
): Promise<T> {
  const existing = writeQueues.get(slug) || Promise.resolve();
  const queued = existing.then(
    () => operation(),
    () => operation()
  );
  // Store void promise reference once for cleanup comparison
  const voidPromise = queued.then(
    () => {},
    () => {}
  );
  writeQueues.set(slug, voidPromise);

  try {
    return await queued;
  } finally {
    // Clean up completed promise if it's still the current one
    if (writeQueues.get(slug) === voidPromise) {
      writeQueues.delete(slug);
    }
  }
}

/**
 * Checks if a value is a v1 single SubmissionRecord
 */
function isV1Record(value: unknown): value is SubmissionRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    'submissionId' in value &&
    'at' in value &&
    'problem' in value &&
    !Array.isArray(value)
  );
}

/**
 * Checks if a value is a v2 history array
 */
function isV2History(value: unknown): value is SubmissionRecord[] {
  return Array.isArray(value);
}

/**
 * Migrates v1 single record to v2 history format
 */
function migrateToV2(value: unknown): SubmissionRecord[] {
  if (isV1Record(value)) {
    return [value];
  }
  if (isV2History(value)) {
    return value;
  }
  return [];
}

/**
 * Ensures schema version is set in storage
 */
async function ensureSchemaVersion(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.get([SCHEMA_VERSION_KEY], (data) => {
      if (!data[SCHEMA_VERSION_KEY]) {
        chrome.storage.local.set(
          { [SCHEMA_VERSION_KEY]: CURRENT_SCHEMA_VERSION },
          () => {
            void chrome.runtime.lastError;
            resolve();
          }
        );
      } else {
        resolve();
      }
    });
  });
}

/**
 * V2 API: Appends a new submission attempt to the history for a given slug
 */
export async function appendSubmissionAttempt(
  slug: string,
  rec: SubmissionRecord
): Promise<void> {
  await ensureSchemaVersion();

  return withWriteLock(slug, async () => {
    const key = keyFor(slug);

    return new Promise<void>((resolve) => {
      chrome.storage.local.get([key], (data) => {
        const existing = data[key];
        const history = migrateToV2(existing);
        history.push(rec);

        chrome.storage.local.set({ [key]: history }, () => {
          void chrome.runtime.lastError;
          resolve();
        });
      });
    });
  });
}

/**
 * V2 API: Gets the full submission history for a given slug
 * Migrates v1 records to v2 and persists them
 */
export async function getSubmissionHistory(
  slug: string
): Promise<SubmissionRecord[]> {
  await ensureSchemaVersion();
  const key = keyFor(slug);
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (data) => {
      const value = data[key];
      if (!value) {
        resolve([]);
        return;
      }

      // Check if migration is needed
      if (isV1Record(value)) {
        // Migrate v1 to v2 and persist
        const history = [value];
        chrome.storage.local.set({ [key]: history }, () => {
          void chrome.runtime.lastError;
        });
        resolve(history);
      } else {
        resolve(migrateToV2(value));
      }
    });
  });
}

/**
 * V2 API: Gets the latest (most recent) submission for a given slug
 */
export async function getLatestSubmission(
  slug: string
): Promise<SubmissionRecord | null> {
  const history = await getSubmissionHistory(slug);
  return history.length > 0 ? history[history.length - 1] : null;
}

/**
 * V2 API: Gets all submission histories (slug -> array of attempts)
 * Migrates any v1 records to v2 and persists them
 */
export async function getAllSubmissionHistories(): Promise<
  Record<string, SubmissionRecord[]>
> {
  await ensureSchemaVersion();
  return new Promise((resolve) => {
    chrome.storage.local.get(null, (items) => {
      const out: Record<string, SubmissionRecord[]> = {};
      const migrationsNeeded: Record<string, SubmissionRecord[]> = {};

      for (const [k, v] of Object.entries(items)) {
        if (k.startsWith(PREFIX)) {
          const slug = k.slice(PREFIX.length);

          // Check if migration is needed
          if (isV1Record(v)) {
            const history = [v];
            out[slug] = history;
            migrationsNeeded[k] = history;
          } else {
            out[slug] = migrateToV2(v);
          }
        }
      }

      // Persist any v1 records that were migrated
      if (Object.keys(migrationsNeeded).length > 0) {
        chrome.storage.local.set(migrationsNeeded, () => {
          void chrome.runtime.lastError;
        });
      }

      resolve(out);
    });
  });
}

// ============================================================================
// LEGACY V1 APIs - Kept for backward compatibility during transition
// ============================================================================

/**
 * @deprecated Use appendSubmissionAttempt instead
 */
export function saveSubmission(slug: string, rec: SubmissionRecord) {
  appendSubmissionAttempt(slug, rec);
}

/**
 * @deprecated Use getLatestSubmission instead
 */
export function getSubmission(slug: string): Promise<SubmissionRecord | null> {
  return getLatestSubmission(slug);
}

/**
 * @deprecated Use getAllSubmissionHistories instead, then extract latest from each
 */
export async function getAllSubmissions(): Promise<
  Record<string, SubmissionRecord>
> {
  const histories = await getAllSubmissionHistories();
  const out: Record<string, SubmissionRecord> = {};
  for (const [slug, history] of Object.entries(histories)) {
    if (history.length > 0) {
      out[slug] = history[history.length - 1];
    }
  }
  return out;
}

// ============================================================================
// Clear APIs
// ============================================================================

export function clearSubmissions(slug?: string) {
  if (!slug) {
    // clear all problem submissions (both v1 and v2)
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
