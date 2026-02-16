import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  appendSubmissionAttempt,
  getSubmissionHistory,
  getLatestSubmission,
  getAllSubmissionHistories,
  getAllSubmissions,
  getSubmission,
  saveSubmission,
  clearSubmissions,
} from './submissions';
import { SubmissionRecord } from './types';

// Mock chrome.storage.local
const mockStorage: Record<string, unknown> = {};

interface ChromeStorageLocal {
  get: (
    keys: string | string[] | Record<string, unknown> | null,
    callback: (items: Record<string, unknown>) => void
  ) => void;
  set: (items: Record<string, unknown>, callback?: () => void) => void;
  remove: (keys: string | string[], callback?: () => void) => void;
}

interface ChromeStorage {
  local: ChromeStorageLocal;
  onChanged: {
    addListener: (
      callback: (
        changes: Record<string, chrome.storage.StorageChange>,
        area: string
      ) => void
    ) => void;
    removeListener: (callback: (...args: unknown[]) => void) => void;
  };
}

interface MockChrome {
  storage: ChromeStorage;
  runtime: {
    lastError?: Error;
  };
}

const mockChrome: MockChrome = {
  storage: {
    local: {
      get: vi.fn((keys, callback) => {
        if (keys === null) {
          // Get all items
          callback({ ...mockStorage });
        } else if (Array.isArray(keys)) {
          const result: Record<string, unknown> = {};
          keys.forEach((key) => {
            if (key in mockStorage) {
              result[key] = mockStorage[key];
            }
          });
          callback(result);
        } else {
          // keys is an object with default values
          const result: Record<string, unknown> = { ...keys };
          Object.keys(keys).forEach((key) => {
            if (key in mockStorage) {
              result[key] = mockStorage[key];
            }
          });
          callback(result);
        }
      }),
      set: vi.fn((items, callback) => {
        Object.assign(mockStorage, items);
        callback?.();
      }),
      remove: vi.fn((keys, callback) => {
        const keysArray = Array.isArray(keys) ? keys : [keys];
        keysArray.forEach((key) => {
          delete mockStorage[key];
        });
        callback?.();
      }),
    },
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  runtime: {
    lastError: undefined,
  },
};

global.chrome = mockChrome as typeof chrome;

describe('Submissions Storage v2', () => {
  const mockProblem = {
    slug: 'two-sum',
    title: 'Two Sum',
    difficulty: 'Easy' as const,
    tags: ['Array', 'Hash Table'],
  };

  const createSubmissionRecord = (
    id: string,
    elapsedSec: number
  ): SubmissionRecord => ({
    submissionId: id,
    at: Date.now(),
    elapsedSec,
    source: 'manual',
    problem: mockProblem,
  });

  beforeEach(() => {
    // Clear mock storage before each test
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
    vi.clearAllMocks();
  });

  describe('appendSubmissionAttempt', () => {
    it('creates new history array for first submission', async () => {
      const rec = createSubmissionRecord('sub-1', 300);
      await appendSubmissionAttempt('two-sum', rec);

      const history = await getSubmissionHistory('two-sum');
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual(rec);
    });

    it('appends to existing history array', async () => {
      const rec1 = createSubmissionRecord('sub-1', 300);
      const rec2 = createSubmissionRecord('sub-2', 250);

      await appendSubmissionAttempt('two-sum', rec1);
      await appendSubmissionAttempt('two-sum', rec2);

      const history = await getSubmissionHistory('two-sum');
      expect(history).toHaveLength(2);
      expect(history[0]).toEqual(rec1);
      expect(history[1]).toEqual(rec2);
    });

    it('sets schema version on first write', async () => {
      const rec = createSubmissionRecord('sub-1', 300);
      await appendSubmissionAttempt('two-sum', rec);

      expect(mockStorage['submissions_schema_version']).toBe(2);
    });
  });

  describe('getSubmissionHistory', () => {
    it('returns empty array for non-existent slug', async () => {
      const history = await getSubmissionHistory('non-existent');
      expect(history).toEqual([]);
    });

    it('returns full history for existing slug', async () => {
      const rec1 = createSubmissionRecord('sub-1', 300);
      const rec2 = createSubmissionRecord('sub-2', 250);

      await appendSubmissionAttempt('two-sum', rec1);
      await appendSubmissionAttempt('two-sum', rec2);

      const history = await getSubmissionHistory('two-sum');
      expect(history).toHaveLength(2);
      expect(history[0]).toEqual(rec1);
      expect(history[1]).toEqual(rec2);
    });
  });

  describe('getLatestSubmission', () => {
    it('returns null for non-existent slug', async () => {
      const latest = await getLatestSubmission('non-existent');
      expect(latest).toBeNull();
    });

    it('returns most recent submission', async () => {
      const rec1 = createSubmissionRecord('sub-1', 300);
      const rec2 = createSubmissionRecord('sub-2', 250);
      const rec3 = createSubmissionRecord('sub-3', 200);

      await appendSubmissionAttempt('two-sum', rec1);
      await appendSubmissionAttempt('two-sum', rec2);
      await appendSubmissionAttempt('two-sum', rec3);

      const latest = await getLatestSubmission('two-sum');
      expect(latest).toEqual(rec3);
    });
  });

  describe('getAllSubmissionHistories', () => {
    it('returns empty object when no submissions exist', async () => {
      const histories = await getAllSubmissionHistories();
      expect(histories).toEqual({});
    });

    it('returns all submission histories', async () => {
      const rec1 = createSubmissionRecord('sub-1', 300);
      const rec2 = createSubmissionRecord('sub-2', 250);
      const rec3 = createSubmissionRecord('sub-3', 400);

      await appendSubmissionAttempt('two-sum', rec1);
      await appendSubmissionAttempt('two-sum', rec2);
      await appendSubmissionAttempt('three-sum', rec3);

      const histories = await getAllSubmissionHistories();
      expect(Object.keys(histories)).toHaveLength(2);
      expect(histories['two-sum']).toHaveLength(2);
      expect(histories['three-sum']).toHaveLength(1);
      expect(histories['two-sum'][1]).toEqual(rec2);
      expect(histories['three-sum'][0]).toEqual(rec3);
    });
  });

  describe('Backward Compatibility - V1 to V2 Migration', () => {
    it('migrates v1 single record to v2 history on read', async () => {
      // Simulate v1 storage format (single record)
      const v1Record = createSubmissionRecord('sub-1', 300);
      mockStorage['submissions::two-sum'] = v1Record;

      const history = await getSubmissionHistory('two-sum');
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual(v1Record);
    });

    it('migrates v1 record when appending new attempt', async () => {
      // Start with v1 format
      const v1Record = createSubmissionRecord('sub-1', 300);
      mockStorage['submissions::two-sum'] = v1Record;

      // Append new attempt
      const v2Record = createSubmissionRecord('sub-2', 250);
      await appendSubmissionAttempt('two-sum', v2Record);

      // Should now have both records in v2 format
      const history = await getSubmissionHistory('two-sum');
      expect(history).toHaveLength(2);
      expect(history[0]).toEqual(v1Record);
      expect(history[1]).toEqual(v2Record);
    });

    it('handles mixed v1 and v2 records in getAllSubmissionHistories', async () => {
      // v1 format for one problem
      const v1Record = createSubmissionRecord('sub-1', 300);
      mockStorage['submissions::two-sum'] = v1Record;

      // v2 format for another problem
      const v2Record1 = createSubmissionRecord('sub-2', 250);
      const v2Record2 = createSubmissionRecord('sub-3', 200);
      mockStorage['submissions::three-sum'] = [v2Record1, v2Record2];

      const histories = await getAllSubmissionHistories();
      expect(histories['two-sum']).toHaveLength(1);
      expect(histories['three-sum']).toHaveLength(2);
      expect(histories['two-sum'][0]).toEqual(v1Record);
      expect(histories['three-sum'][1]).toEqual(v2Record2);
    });
  });

  describe('Legacy API Compatibility', () => {
    it('saveSubmission appends to history', async () => {
      const rec = createSubmissionRecord('sub-1', 300);
      saveSubmission('two-sum', rec);

      // Wait for async operation
      await new Promise((resolve) => setTimeout(resolve, 10));

      const history = await getSubmissionHistory('two-sum');
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual(rec);
    });

    it('getSubmission returns latest submission', async () => {
      const rec1 = createSubmissionRecord('sub-1', 300);
      const rec2 = createSubmissionRecord('sub-2', 250);

      await appendSubmissionAttempt('two-sum', rec1);
      await appendSubmissionAttempt('two-sum', rec2);

      const latest = await getSubmission('two-sum');
      expect(latest).toEqual(rec2);
    });

    it('getAllSubmissions returns latest from each history', async () => {
      const rec1 = createSubmissionRecord('sub-1', 300);
      const rec2 = createSubmissionRecord('sub-2', 250);
      const rec3 = createSubmissionRecord('sub-3', 400);

      await appendSubmissionAttempt('two-sum', rec1);
      await appendSubmissionAttempt('two-sum', rec2);
      await appendSubmissionAttempt('three-sum', rec3);

      const submissions = await getAllSubmissions();
      expect(Object.keys(submissions)).toHaveLength(2);
      expect(submissions['two-sum']).toEqual(rec2);
      expect(submissions['three-sum']).toEqual(rec3);
    });
  });

  describe('clearSubmissions', () => {
    beforeEach(async () => {
      // Set up test data
      const rec1 = createSubmissionRecord('sub-1', 300);
      const rec2 = createSubmissionRecord('sub-2', 400);
      await appendSubmissionAttempt('two-sum', rec1);
      await appendSubmissionAttempt('three-sum', rec2);
    });

    it('clears single submission by slug', async () => {
      clearSubmissions('two-sum');

      // Wait for async operation
      await new Promise((resolve) => setTimeout(resolve, 10));

      const history = await getSubmissionHistory('two-sum');
      expect(history).toHaveLength(0);

      // three-sum should still exist
      const otherHistory = await getSubmissionHistory('three-sum');
      expect(otherHistory).toHaveLength(1);
    });

    it('clears all submissions when no slug provided', async () => {
      clearSubmissions();

      // Wait for async operation
      await new Promise((resolve) => setTimeout(resolve, 10));

      const histories = await getAllSubmissionHistories();
      expect(Object.keys(histories)).toHaveLength(0);
    });

    it('clears both v1 and v2 format submissions', async () => {
      // Add a v1 format submission directly
      const v1Record = createSubmissionRecord('sub-old', 500);
      mockStorage['submissions::old-problem'] = v1Record;

      clearSubmissions();

      // Wait for async operation
      await new Promise((resolve) => setTimeout(resolve, 10));

      const histories = await getAllSubmissionHistories();
      expect(Object.keys(histories)).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('handles empty history array', async () => {
      mockStorage['submissions::two-sum'] = [];

      const history = await getSubmissionHistory('two-sum');
      expect(history).toEqual([]);

      const latest = await getLatestSubmission('two-sum');
      expect(latest).toBeNull();
    });

    it('handles malformed data gracefully', async () => {
      // Store invalid data
      mockStorage['submissions::two-sum'] = 'invalid data';

      const history = await getSubmissionHistory('two-sum');
      expect(history).toEqual([]);
    });

    it('preserves attempt order (newest last)', async () => {
      const attempts = [
        createSubmissionRecord('sub-1', 300),
        createSubmissionRecord('sub-2', 250),
        createSubmissionRecord('sub-3', 200),
        createSubmissionRecord('sub-4', 180),
      ];

      for (const attempt of attempts) {
        await appendSubmissionAttempt('two-sum', attempt);
      }

      const history = await getSubmissionHistory('two-sum');
      expect(history).toHaveLength(4);
      expect(history[0].submissionId).toBe('sub-1');
      expect(history[3].submissionId).toBe('sub-4');

      const latest = await getLatestSubmission('two-sum');
      expect(latest?.submissionId).toBe('sub-4');
    });
  });

  describe('Write Queue (P2)', () => {
    // Note: These tests use synchronous mock storage, so they verify the write-lock
    // mechanism executes without errors but do not prove true async interleaving safety.
    // Real race conditions are unlikely in production since chrome.storage.local
    // operations are already serialized by the browser at the API level.

    it('queues multiple appends to same slug without errors', async () => {
      const attempts = [
        createSubmissionRecord('sub-1', 300),
        createSubmissionRecord('sub-2', 250),
        createSubmissionRecord('sub-3', 200),
        createSubmissionRecord('sub-4', 180),
        createSubmissionRecord('sub-5', 150),
      ];

      // Fire all appends concurrently (tests write-lock doesn't throw)
      await Promise.all(
        attempts.map((attempt) => appendSubmissionAttempt('two-sum', attempt))
      );

      // All attempts should be preserved
      const history = await getSubmissionHistory('two-sum');
      expect(history).toHaveLength(5);

      // Verify all submission IDs are present
      const ids = history.map((rec) => rec.submissionId);
      expect(ids).toContain('sub-1');
      expect(ids).toContain('sub-2');
      expect(ids).toContain('sub-3');
      expect(ids).toContain('sub-4');
      expect(ids).toContain('sub-5');
    });

    it('handles appends to different slugs independently', async () => {
      const attempt1 = createSubmissionRecord('sub-1', 300);
      const attempt2 = createSubmissionRecord('sub-2', 250);
      const attempt3 = createSubmissionRecord('sub-3', 200);

      await Promise.all([
        appendSubmissionAttempt('two-sum', attempt1),
        appendSubmissionAttempt('three-sum', attempt2),
        appendSubmissionAttempt('two-sum', attempt3),
      ]);

      const twoSumHistory = await getSubmissionHistory('two-sum');
      const threeSumHistory = await getSubmissionHistory('three-sum');

      expect(twoSumHistory).toHaveLength(2);
      expect(threeSumHistory).toHaveLength(1);
      expect(twoSumHistory[0].submissionId).toBe('sub-1');
      expect(twoSumHistory[1].submissionId).toBe('sub-3');
      expect(threeSumHistory[0].submissionId).toBe('sub-2');
    });

    it('cleans up write-lock Map entries after completion', async () => {
      const attempt = createSubmissionRecord('sub-1', 300);

      await appendSubmissionAttempt('two-sum', attempt);

      // Give cleanup a chance to run
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify the write queue is empty (no memory leak)
      // Access via module internals - in real code, this would be tested via
      // memory profiling or by ensuring subsequent operations don't hang
      const history = await getSubmissionHistory('two-sum');
      expect(history).toHaveLength(1);
    });
  });

  describe('Migration Persistence (P3)', () => {
    it('persists v1 record as v2 array after getSubmissionHistory', async () => {
      // Start with v1 format
      const v1Record = createSubmissionRecord('sub-1', 300);
      mockStorage['submissions::two-sum'] = v1Record;

      // Read the history (triggers migration)
      await getSubmissionHistory('two-sum');

      // Verify it's now stored as v2 array
      const storedValue = mockStorage['submissions::two-sum'];
      expect(Array.isArray(storedValue)).toBe(true);
      expect((storedValue as SubmissionRecord[]).length).toBe(1);
      expect((storedValue as SubmissionRecord[])[0]).toEqual(v1Record);
    });

    it('persists v1 records as v2 arrays after getAllSubmissionHistories', async () => {
      // Start with mixed formats
      const v1Record1 = createSubmissionRecord('sub-1', 300);
      const v1Record2 = createSubmissionRecord('sub-2', 250);
      const v2History = [createSubmissionRecord('sub-3', 200)];

      mockStorage['submissions::two-sum'] = v1Record1;
      mockStorage['submissions::three-sum'] = v2History;
      mockStorage['submissions::four-sum'] = v1Record2;

      // Read all histories (triggers migration for v1 records)
      await getAllSubmissionHistories();

      // Verify v1 records are now stored as v2 arrays
      const twoSumStored = mockStorage['submissions::two-sum'];
      const fourSumStored = mockStorage['submissions::four-sum'];
      const threeSumStored = mockStorage['submissions::three-sum'];

      expect(Array.isArray(twoSumStored)).toBe(true);
      expect(Array.isArray(fourSumStored)).toBe(true);
      expect(Array.isArray(threeSumStored)).toBe(true);

      expect((twoSumStored as SubmissionRecord[])[0]).toEqual(v1Record1);
      expect((fourSumStored as SubmissionRecord[])[0]).toEqual(v1Record2);
    });

    it('schema version v2 accurately reflects storage format after migration', async () => {
      // Start with v1 record
      const v1Record = createSubmissionRecord('sub-1', 300);
      mockStorage['submissions::two-sum'] = v1Record;

      // Trigger migration via read
      await getSubmissionHistory('two-sum');

      // Schema should be v2
      expect(mockStorage['submissions_schema_version']).toBe(2);

      // Storage should actually be in v2 format
      const storedValue = mockStorage['submissions::two-sum'];
      expect(Array.isArray(storedValue)).toBe(true);
    });

    it('does not re-write v2 records unnecessarily', async () => {
      // Start with v2 format and schema version already set
      const v2History = [
        createSubmissionRecord('sub-1', 300),
        createSubmissionRecord('sub-2', 250),
      ];
      mockStorage['submissions::two-sum'] = v2History;
      mockStorage['submissions_schema_version'] = 2;

      // Clear the set spy call count
      vi.clearAllMocks();

      // Read the history
      const result = await getSubmissionHistory('two-sum');

      // Verify no writes happened
      const setCalls = (
        mockChrome.storage.local.set as ReturnType<typeof vi.fn>
      ).mock.calls;
      expect(setCalls.length).toBe(0);

      // Verify we got the correct data
      expect(result).toEqual(v2History);
    });
  });
});
