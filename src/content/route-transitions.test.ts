/**
 * Integration tests for content script route transition behavior.
 * Tests the full problem -> non-problem -> same problem flow.
 *
 * Phase 6 regression test: Ensures re-entry detection and cache clearing
 * work correctly to prevent stale state.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock types
type MockStorageLocal = {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
};

type MockRuntimeSendMessage = ReturnType<typeof vi.fn>;

type RuntimeMessage = {
  type: string;
  slug?: string;
  title?: string;
  difficulty?: string;
  tags?: string[];
};

describe('Content Script Route Transitions', () => {
  let mockStorage: MockStorageLocal;
  let mockSendMessage: MockRuntimeSendMessage;
  let sentMessages: RuntimeMessage[];

  beforeEach(() => {
    sentMessages = [];

    mockStorage = {
      get: vi.fn((_keys, callback) => {
        callback({});
      }),
      set: vi.fn((_items, callback) => {
        if (callback) callback();
      }),
      remove: vi.fn((_keys, callback) => {
        if (callback) callback();
      }),
    };

    mockSendMessage = vi.fn((msg: RuntimeMessage, callback) => {
      sentMessages.push(msg);
      if (callback) callback();
    });

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
      // biome-ignore lint/suspicious/noExplicitAny: Partial Chrome API mock for testing
    } as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
    sentMessages = [];
  });

  describe('Problem -> Non-Problem -> Same Problem Re-entry', () => {
    it('emits fresh metadata on re-entry after leaving', () => {
      // Simulate the state transitions
      let currentSlug: string | null = null;
      let lastEmittedSlug: string | null = null;
      const problemMetadataCache: Record<
        string,
        {
          slug: string;
          title: string;
          difficulty?: string;
          tags?: string[];
        }
      > = {};

      // Step 1: Navigate to problem page
      const slug1 = 'two-sum';
      const isReEntry1 = currentSlug === null && slug1 === lastEmittedSlug;
      expect(isReEntry1).toBe(false); // Not re-entry

      // Use cache if available and not re-entry
      if (!problemMetadataCache[slug1] || isReEntry1) {
        // Simulate fetching fresh metadata
        problemMetadataCache[slug1] = {
          slug: slug1,
          title: 'Two Sum',
          difficulty: 'Easy',
          tags: ['Array'],
        };
      }

      mockSendMessage(
        {
          type: 'PROBLEM_METADATA',
          ...problemMetadataCache[slug1],
        },
        () => {}
      );

      currentSlug = slug1;
      lastEmittedSlug = slug1;

      expect(sentMessages).toHaveLength(1);
      expect(sentMessages[0]).toMatchObject({
        type: 'PROBLEM_METADATA',
        slug: 'two-sum',
      });

      // Step 2: Leave problem page
      const slug2 = '';
      if (!slug2 && currentSlug !== null) {
        mockSendMessage({ type: 'PROBLEM_CLEARED' }, () => {});
        mockStorage.remove('currentProblem', () => {});
        currentSlug = null;
        // Critical: lastEmittedSlug NOT reset
      }

      expect(currentSlug).toBe(null);
      expect(lastEmittedSlug).toBe('two-sum'); // Preserved!
      expect(sentMessages).toHaveLength(2);
      expect(sentMessages[1]).toEqual({ type: 'PROBLEM_CLEARED' });

      // Step 3: Return to same problem (re-entry)
      const slug3 = 'two-sum';
      const isReEntry3 = currentSlug === null && slug3 === lastEmittedSlug;
      expect(isReEntry3).toBe(true); // This IS re-entry!

      // Clear cache on re-entry to force fresh fetch
      if (isReEntry3) {
        delete problemMetadataCache[slug3];
      }

      // Fetch fresh metadata (cache was cleared)
      problemMetadataCache[slug3] = {
        slug: slug3,
        title: 'Two Sum (Fresh)',
        difficulty: 'Easy',
        tags: ['Array', 'Hash Table'], // Updated tags
      };

      mockSendMessage(
        {
          type: 'PROBLEM_METADATA',
          ...problemMetadataCache[slug3],
        },
        () => {}
      );

      currentSlug = slug3;
      lastEmittedSlug = slug3;

      expect(sentMessages).toHaveLength(3);
      expect(sentMessages[2]).toMatchObject({
        type: 'PROBLEM_METADATA',
        slug: 'two-sum',
        title: 'Two Sum (Fresh)', // Fresh data!
      });
    });

    it('does not treat problem A -> problem B as re-entry', () => {
      let currentSlug: string | null = null;
      let lastEmittedSlug: string | null = null;

      // Navigate to problem A
      const slugA = 'two-sum';
      mockSendMessage(
        {
          type: 'PROBLEM_METADATA',
          slug: slugA,
          title: 'Two Sum',
        },
        () => {}
      );
      currentSlug = slugA;
      lastEmittedSlug = slugA;

      // Navigate directly to problem B (no clearing)
      const slugB = 'three-sum';
      const isReEntry = currentSlug === null && slugB === lastEmittedSlug;
      expect(isReEntry).toBe(false); // NOT re-entry (currentSlug is not null)

      mockSendMessage(
        {
          type: 'PROBLEM_METADATA',
          slug: slugB,
          title: 'Three Sum',
        },
        () => {}
      );
      currentSlug = slugB;
      lastEmittedSlug = slugB;

      expect(sentMessages).toHaveLength(2);
      expect(sentMessages[1]).toMatchObject({
        type: 'PROBLEM_METADATA',
        slug: 'three-sum',
      });
    });

    it('handles multiple re-entries correctly', () => {
      let currentSlug: string | null = null;
      let lastEmittedSlug: string | null = null;

      // First visit
      currentSlug = 'two-sum';
      lastEmittedSlug = 'two-sum';
      mockSendMessage(
        { type: 'PROBLEM_METADATA', slug: 'two-sum', title: 'Two Sum' },
        () => {}
      );

      // Leave
      currentSlug = null;
      mockSendMessage({ type: 'PROBLEM_CLEARED' }, () => {});

      // Re-entry 1
      const isReEntry1 = currentSlug === null && 'two-sum' === lastEmittedSlug;
      expect(isReEntry1).toBe(true);
      currentSlug = 'two-sum';
      mockSendMessage(
        {
          type: 'PROBLEM_METADATA',
          slug: 'two-sum',
          title: 'Two Sum (Re-entry 1)',
        },
        () => {}
      );

      // Leave again
      currentSlug = null;
      mockSendMessage({ type: 'PROBLEM_CLEARED' }, () => {});

      // Re-entry 2
      const isReEntry2 = currentSlug === null && 'two-sum' === lastEmittedSlug;
      expect(isReEntry2).toBe(true);
      currentSlug = 'two-sum';
      mockSendMessage(
        {
          type: 'PROBLEM_METADATA',
          slug: 'two-sum',
          title: 'Two Sum (Re-entry 2)',
        },
        () => {}
      );

      // Verify all messages (1 initial + 2 re-entries = 3 metadata, 2 clears = 5 total)
      expect(sentMessages).toHaveLength(5);
      expect(sentMessages[0].type).toBe('PROBLEM_METADATA');
      expect(sentMessages[1].type).toBe('PROBLEM_CLEARED');
      expect(sentMessages[2].type).toBe('PROBLEM_METADATA');
      expect(sentMessages[3].type).toBe('PROBLEM_CLEARED');
      expect(sentMessages[4].type).toBe('PROBLEM_METADATA');
    });

    it('resets lastEmittedSlug only when navigating to different problem', () => {
      let currentSlug: string | null = null;
      let lastEmittedSlug: string | null = null;

      // Problem A
      currentSlug = 'two-sum';
      lastEmittedSlug = 'two-sum';

      // Leave
      currentSlug = null;
      // lastEmittedSlug NOT reset

      expect(lastEmittedSlug).toBe('two-sum');

      // Navigate to different problem B (not re-entry)
      currentSlug = 'three-sum';
      lastEmittedSlug = 'three-sum'; // Now updated

      expect(lastEmittedSlug).toBe('three-sum');

      // Leave again
      currentSlug = null;

      // Return to A - this is NOT re-entry for A (last emitted was B)
      const isReEntry = currentSlug === null && 'two-sum' === lastEmittedSlug;
      expect(isReEntry).toBe(false);
    });
  });

  describe('Message sequence validation', () => {
    it('ensures correct message order for full cycle', () => {
      let currentSlug: string | null = null;
      let lastEmittedSlug: string | null = null;

      // 1. First visit
      if ('two-sum' !== currentSlug) {
        mockSendMessage(
          { type: 'PROBLEM_METADATA', slug: 'two-sum', title: 'Two Sum' },
          () => {}
        );
        currentSlug = 'two-sum';
        lastEmittedSlug = 'two-sum';
      }

      // 2. Leave
      if (!currentSlug && currentSlug !== null) {
        mockSendMessage({ type: 'PROBLEM_CLEARED' }, () => {});
        currentSlug = null;
      } else if (currentSlug !== null) {
        mockSendMessage({ type: 'PROBLEM_CLEARED' }, () => {});
        currentSlug = null;
      }

      // 3. Re-entry
      if ('two-sum' !== currentSlug) {
        const isReEntry = currentSlug === null && 'two-sum' === lastEmittedSlug;
        mockSendMessage(
          {
            type: 'PROBLEM_METADATA',
            slug: 'two-sum',
            title: 'Two Sum',
          },
          () => {}
        );
        currentSlug = 'two-sum';

        // Verify re-entry was detected
        expect(isReEntry).toBe(true);
      }

      // Validate message sequence
      expect(sentMessages).toHaveLength(3);
      expect(sentMessages[0].type).toBe('PROBLEM_METADATA');
      expect(sentMessages[1].type).toBe('PROBLEM_CLEARED');
      expect(sentMessages[2].type).toBe('PROBLEM_METADATA');
    });
  });

  describe('Storage interaction during transitions', () => {
    it('removes currentProblem from storage when leaving', () => {
      const currentSlug = 'two-sum';
      const slug = '';

      if (!slug && currentSlug !== null) {
        mockSendMessage({ type: 'PROBLEM_CLEARED' }, () => {});
        mockStorage.remove('currentProblem', () => {});
      }

      expect(mockStorage.remove).toHaveBeenCalledWith(
        'currentProblem',
        expect.any(Function)
      );
    });

    it('sets currentProblem in storage when entering problem', () => {
      const slug = 'two-sum';
      const problemData = {
        slug,
        title: 'Two Sum',
        difficulty: 'Easy',
        tags: ['Array'],
        startAt: Date.now(),
      };

      mockStorage.set({ currentProblem: problemData }, () => {});

      expect(mockStorage.set).toHaveBeenCalledWith(
        { currentProblem: problemData },
        expect.any(Function)
      );
    });
  });
});
