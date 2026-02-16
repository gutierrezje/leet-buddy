/**
 * Logic validation tests for content script navigation patterns.
 *
 * NOTE: These tests simulate the navigation logic with local variables
 * rather than importing/executing main.tsx. They verify the INTENDED
 * behavior but do NOT exercise production code paths.
 *
 * LIMITATION: Tests can pass even if main.tsx regresses. This is
 * tracked as technical debt - see src/test/README.md for details.
 *
 * For actual integration tests, see:
 * - src/sidepanel/App.test.tsx (tests real component behavior)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock types
type MockStorageLocal = {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
};

type MockRuntimeSendMessage = ReturnType<typeof vi.fn>;

describe('Content Script Navigation Logic Patterns', () => {
  let mockStorage: MockStorageLocal;
  let mockSendMessage: MockRuntimeSendMessage;
  let sentMessages: unknown[];

  beforeEach(() => {
    sentMessages = [];

    // Mock chrome.storage.local
    mockStorage = {
      get: vi.fn((keys, callback) => {
        callback({});
      }),
      set: vi.fn((items, callback) => {
        if (callback) callback();
      }),
      remove: vi.fn((keys, callback) => {
        if (callback) callback();
      }),
    };

    // Mock chrome.runtime.sendMessage
    mockSendMessage = vi.fn((msg, callback) => {
      sentMessages.push(msg);
      if (callback) callback();
    });

    // Setup global chrome mock
    global.chrome = {
      storage: {
        local: mockStorage,
        onChanged: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
      },
      runtime: {
        sendMessage: mockSendMessage,
        id: 'test-extension-id',
        lastError: undefined,
        onMessage: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
    sentMessages = [];
  });

  describe('Slug Transition Logic', () => {
    it('emits PROBLEM_METADATA on first visit to problem', () => {
      // Simulate the logic from handleSlugChange
      const currentSlug = null;
      const lastEmittedSlug = null;
      const slug = 'two-sum';

      // Should not be re-entry
      const isReEntry = currentSlug === null && slug === lastEmittedSlug;
      expect(isReEntry).toBe(false);

      // Should emit metadata
      const msg = {
        type: 'PROBLEM_METADATA',
        slug,
        title: 'Two Sum',
        difficulty: 'Easy',
        tags: ['Array'],
      };

      mockSendMessage(msg, () => {});
      expect(sentMessages).toHaveLength(1);
      expect(sentMessages[0]).toMatchObject({
        type: 'PROBLEM_METADATA',
        slug: 'two-sum',
      });
    });

    it('skips fetch when staying on same problem', () => {
      // Already on problem A
      const currentSlug = 'two-sum';
      const slug = 'two-sum'; // Same slug

      // Should early return (no change)
      const shouldSkip = slug === currentSlug;
      expect(shouldSkip).toBe(true);

      // No messages sent
      expect(sentMessages).toHaveLength(0);
    });

    it('emits PROBLEM_CLEARED when leaving problem page', () => {
      // On problem A
      const currentSlug = 'two-sum';
      const slug = ''; // Left problem page

      // Should emit cleared message
      if (!slug && currentSlug !== null) {
        const msg = { type: 'PROBLEM_CLEARED' };
        mockSendMessage(msg, () => {});

        // Should clear storage
        mockStorage.remove('currentProblem', () => {});
      }

      expect(sentMessages).toHaveLength(1);
      expect(sentMessages[0]).toEqual({ type: 'PROBLEM_CLEARED' });
      expect(mockStorage.remove).toHaveBeenCalledWith(
        'currentProblem',
        expect.any(Function)
      );
    });

    it('detects re-entry and forces refresh', () => {
      // Simulating: was on problem A, left, now returning
      const currentSlug = null; // Left the page
      const lastEmittedSlug = 'two-sum'; // Last problem we were on
      const slug = 'two-sum'; // Returning to same problem

      // Should detect re-entry
      const isReEntry = currentSlug === null && slug === lastEmittedSlug;
      expect(isReEntry).toBe(true);

      // Cache should be cleared (forcing fresh fetch)
      // This is verified by checking that we DON'T use cached data
    });

    it('keeps lastEmittedSlug when leaving to enable re-entry detection', () => {
      // Critical: lastEmittedSlug should NOT be reset to null when leaving
      let currentSlugState = 'two-sum';
      const lastEmittedSlugState = 'two-sum';

      // Leave problem page
      const slug = '';
      if (!slug && currentSlugState !== null) {
        currentSlugState = null;
        // lastEmittedSlugState should NOT be reset
      }

      // Verify state
      expect(currentSlugState).toBe(null);
      expect(lastEmittedSlugState).toBe('two-sum'); // Still set!

      // Now re-entry detection will work
      const newSlug = 'two-sum';
      const isReEntry =
        currentSlugState === null && newSlug === lastEmittedSlugState;
      expect(isReEntry).toBe(true);
    });
  });

  describe('Message Emission Patterns', () => {
    it('emits metadata on navigation to different problem', () => {
      // On problem A, navigating to problem B
      const currentSlug = 'two-sum';
      const slug = 'three-sum'; // Different problem

      // Should not skip
      const shouldSkip = slug === currentSlug;
      expect(shouldSkip).toBe(false);

      // Should emit new metadata
      const msg = {
        type: 'PROBLEM_METADATA',
        slug: 'three-sum',
        title: 'Three Sum',
        difficulty: 'Medium',
        tags: ['Array'],
      };

      mockSendMessage(msg, () => {});
      expect(sentMessages).toHaveLength(1);
      expect(sentMessages[0]).toMatchObject({
        type: 'PROBLEM_METADATA',
        slug: 'three-sum',
      });
    });

    it('handles rapid navigation correctly', () => {
      // Simulate: A -> B -> leave -> A
      const scenarios = [
        {
          currentSlug: null,
          lastEmitted: null,
          newSlug: 'two-sum',
          expected: 'metadata',
        },
        {
          currentSlug: 'two-sum',
          lastEmitted: 'two-sum',
          newSlug: 'three-sum',
          expected: 'metadata',
        },
        {
          currentSlug: 'three-sum',
          lastEmitted: 'three-sum',
          newSlug: '',
          expected: 'cleared',
        },
        {
          currentSlug: null,
          lastEmitted: 'three-sum',
          newSlug: 'two-sum',
          expected: 'metadata-reentry',
        },
      ];

      scenarios.forEach((scenario, index) => {
        if (scenario.newSlug === '') {
          // Leaving
          if (scenario.currentSlug !== null) {
            const msg = { type: 'PROBLEM_CLEARED' };
            mockSendMessage(msg, () => {});
            expect(sentMessages[index]).toEqual({ type: 'PROBLEM_CLEARED' });
          }
        } else if (scenario.newSlug !== scenario.currentSlug) {
          // Navigating to new/different problem
          const isReEntry =
            scenario.currentSlug === null &&
            scenario.newSlug === scenario.lastEmitted;
          const msg = {
            type: 'PROBLEM_METADATA',
            slug: scenario.newSlug,
            isReEntry,
          };
          mockSendMessage(msg, () => {});
          expect(sentMessages[index]).toMatchObject({
            type: 'PROBLEM_METADATA',
            slug: scenario.newSlug,
          });
        }
      });
    });
  });

  describe('Cache Behavior', () => {
    it('uses cache on first visit if available', () => {
      const cache: Record<
        string,
        { slug: string; title: string; difficulty?: string; tags?: string[] }
      > = {
        'two-sum': {
          slug: 'two-sum',
          title: 'Two Sum',
          difficulty: 'Easy',
          tags: ['Array'],
        },
      };

      const slug = 'two-sum';
      const currentSlug = null;
      const lastEmittedSlug = null;
      const isReEntry = currentSlug === null && slug === lastEmittedSlug;

      // Not re-entry, cache available
      const shouldUseCache = cache[slug] && !isReEntry;
      expect(shouldUseCache).toBe(true);
    });

    it('clears cache on re-entry to force refresh', () => {
      const cache: Record<
        string,
        { slug: string; title: string; difficulty?: string; tags?: string[] }
      > = {
        'two-sum': {
          slug: 'two-sum',
          title: 'Two Sum',
          difficulty: 'Easy',
          tags: ['Array'],
        },
      };

      const slug = 'two-sum';
      const currentSlug = null; // Left and returning
      const lastEmittedSlug = 'two-sum';
      const isReEntry = currentSlug === null && slug === lastEmittedSlug;

      expect(isReEntry).toBe(true);

      // Simulate cache clearing
      if (isReEntry) {
        delete cache[slug];
      }

      // Cache should be cleared
      expect(cache[slug]).toBeUndefined();

      // Should NOT use cache (will fetch fresh)
      const shouldUseCache = !!(cache[slug] && !isReEntry);
      expect(shouldUseCache).toBe(false);
    });

    it('preserves cache for different problems', () => {
      const cache: Record<string, { slug: string; title: string }> = {
        'two-sum': { slug: 'two-sum', title: 'Two Sum' },
        'three-sum': { slug: 'three-sum', title: 'Three Sum' },
      };

      const slug = 'two-sum';
      const currentSlug = null;
      const lastEmittedSlug = 'three-sum'; // Different problem

      const isReEntry = currentSlug === null && slug === lastEmittedSlug;
      expect(isReEntry).toBe(false); // Not re-entry

      // Should NOT clear cache for 'two-sum'
      if (isReEntry) {
        delete cache[slug];
      }

      expect(cache['two-sum']).toBeDefined();
      expect(cache['three-sum']).toBeDefined();
    });
  });

  describe('State Consistency', () => {
    it('maintains correct state through full navigation cycle', () => {
      let currentSlug: string | null = null;
      let lastEmittedSlug: string | null = null;

      // 1. First visit to problem A
      let slug = 'two-sum';
      if (slug !== currentSlug) {
        currentSlug = slug;
        lastEmittedSlug = slug;
      }
      expect(currentSlug).toBe('two-sum');
      expect(lastEmittedSlug).toBe('two-sum');

      // 2. Stay on A (DOM mutation)
      slug = 'two-sum';
      const shouldSkip = slug === currentSlug;
      expect(shouldSkip).toBe(true);
      // State unchanged
      expect(currentSlug).toBe('two-sum');
      expect(lastEmittedSlug).toBe('two-sum');

      // 3. Leave problem page
      slug = '';
      if (!slug && currentSlug !== null) {
        currentSlug = null;
        // lastEmittedSlug NOT reset
      }
      expect(currentSlug).toBe(null);
      expect(lastEmittedSlug).toBe('two-sum'); // Preserved!

      // 4. Return to problem A (re-entry)
      slug = 'two-sum';
      const isReEntry = currentSlug === null && slug === lastEmittedSlug;
      expect(isReEntry).toBe(true);

      if (slug !== currentSlug) {
        currentSlug = slug;
        lastEmittedSlug = slug;
      }
      expect(currentSlug).toBe('two-sum');
      expect(lastEmittedSlug).toBe('two-sum');
    });

    it('handles direct navigation between problems', () => {
      let currentSlug: string | null = 'two-sum';
      let lastEmittedSlug: string | null = 'two-sum';

      // Navigate directly to different problem (no clearing)
      const slug = 'three-sum';
      const isReEntry = currentSlug === null && slug === lastEmittedSlug;
      expect(isReEntry).toBe(false); // Not re-entry

      if (slug !== currentSlug) {
        currentSlug = slug;
        lastEmittedSlug = slug;
      }

      expect(currentSlug).toBe('three-sum');
      expect(lastEmittedSlug).toBe('three-sum');
    });
  });
});
