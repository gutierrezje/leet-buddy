/**
 * Integration tests for App.tsx message handling.
 * Tests the actual sidepanel behavior for Phase 2 messaging protocol.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@/test/test-utils';
import App from './App';
import type {
  ProblemMetadataMessage,
  SubmissionAcceptedMessage,
  ProblemClearedMessage,
} from '@/shared/types';

describe('App Message Handling', () => {
  let messageListeners: Array<(msg: unknown) => void> = [];
  let mockStorage: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    messageListeners = [];

    // Mock chrome.runtime.onMessage
    const mockOnMessage = {
      addListener: vi.fn((listener) => {
        messageListeners.push(listener);
      }),
      removeListener: vi.fn((listener) => {
        const index = messageListeners.indexOf(listener);
        if (index > -1) {
          messageListeners.splice(index, 1);
        }
      }),
    };

    // Mock chrome.storage.local
    mockStorage = {
      get: vi.fn((keys, callback) => {
        // Return empty by default
        callback({});
      }),
      set: vi.fn((items, callback) => {
        if (callback) callback();
      }),
    };

    // Mock chrome.storage.onChanged
    const mockOnChanged = {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    };

    // Setup global chrome mock
    global.chrome = {
      storage: {
        local: mockStorage,
        onChanged: mockOnChanged,
      },
      runtime: {
        onMessage: mockOnMessage,
        sendMessage: vi.fn(),
        id: 'test-extension-id',
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
    messageListeners = [];
  });

  const simulateMessage = async (msg: unknown) => {
    await act(async () => {
      messageListeners.forEach((listener) => listener(msg));
      // Allow React to process state updates
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  };

  describe('PROBLEM_METADATA handling', () => {
    it('updates currentProblem on receiving metadata for new problem', async () => {
      // Setup: API key in storage
      mockStorage.get.mockImplementation((keys, callback) => {
        callback({ apiKey: 'test-api-key' });
      });

      render(<App />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Simulate receiving problem metadata
      const msg: ProblemMetadataMessage = {
        type: 'PROBLEM_METADATA',
        slug: 'two-sum',
        title: 'Two Sum',
        difficulty: 'Easy',
        tags: ['Array', 'Hash Table'],
      };

      await simulateMessage(msg);

      // Verify problem title is displayed
      await waitFor(() => {
        expect(screen.getByText('Two Sum')).toBeInTheDocument();
      });
    });

    it('updates metadata for same problem without resetting chat', async () => {
      mockStorage.get.mockImplementation((keys, callback) => {
        callback({
          apiKey: 'test-api-key',
          currentProblem: {
            slug: 'two-sum',
            title: 'Two Sum (old)',
            difficulty: 'Easy',
            tags: ['Array'],
          },
        });
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Two Sum (old)')).toBeInTheDocument();
      });

      // Send updated metadata for same problem
      const msg: ProblemMetadataMessage = {
        type: 'PROBLEM_METADATA',
        slug: 'two-sum',
        title: 'Two Sum (updated)',
        difficulty: 'Easy',
        tags: ['Array', 'Hash Table'],
      };

      await simulateMessage(msg);

      // Title should update
      await waitFor(() => {
        expect(screen.getByText('Two Sum (updated)')).toBeInTheDocument();
      });

      // Chat should still show initial messages (not reset)
      expect(
        screen.getByText(/Hello! I'm here to help you practice/i)
      ).toBeInTheDocument();
    });

    it('resets chat when navigating to different problem', async () => {
      mockStorage.get.mockImplementation((keys, callback) => {
        callback({
          apiKey: 'test-api-key',
          currentProblem: {
            slug: 'two-sum',
            title: 'Two Sum',
            difficulty: 'Easy',
            tags: ['Array'],
          },
        });
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Two Sum')).toBeInTheDocument();
      });

      // Navigate to different problem
      const msg: ProblemMetadataMessage = {
        type: 'PROBLEM_METADATA',
        slug: 'three-sum',
        title: 'Three Sum',
        difficulty: 'Medium',
        tags: ['Array', 'Two Pointers'],
      };

      await simulateMessage(msg);

      // New problem title displayed
      await waitFor(() => {
        expect(screen.getByText('Three Sum')).toBeInTheDocument();
      });

      // Chat should show initial greeting (was reset)
      expect(
        screen.getByText(/Hello! I'm here to help you practice/i)
      ).toBeInTheDocument();
    });
  });

  describe('PROBLEM_CLEARED handling', () => {
    it('clears currentProblem and shows empty state', async () => {
      // Start with a problem loaded
      mockStorage.get.mockImplementation((keys, callback) => {
        callback({
          apiKey: 'test-api-key',
          currentProblem: {
            slug: 'two-sum',
            title: 'Two Sum',
            difficulty: 'Easy',
            tags: ['Array'],
          },
        });
      });

      render(<App />);

      // Problem should be displayed
      await waitFor(() => {
        expect(screen.getByText('Two Sum')).toBeInTheDocument();
      });

      // Simulate leaving problem page
      const msg: ProblemClearedMessage = {
        type: 'PROBLEM_CLEARED',
      };

      await simulateMessage(msg);

      // Should show empty state
      await waitFor(() => {
        expect(
          screen.getByText(/Navigate to a LeetCode problem/i)
        ).toBeInTheDocument();
      });

      // Problem title should be gone
      expect(screen.queryByText('Two Sum')).not.toBeInTheDocument();
    });

    it('resets chat session on PROBLEM_CLEARED', async () => {
      mockStorage.get.mockImplementation((keys, callback) => {
        callback({
          apiKey: 'test-api-key',
          currentProblem: {
            slug: 'two-sum',
            title: 'Two Sum',
            difficulty: 'Easy',
            tags: ['Array'],
          },
        });
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Two Sum')).toBeInTheDocument();
      });

      // Clear problem
      const msg: ProblemClearedMessage = {
        type: 'PROBLEM_CLEARED',
      };

      await simulateMessage(msg);

      // Should reset to empty state (no chat visible)
      await waitFor(() => {
        expect(
          screen.getByText(/Navigate to a LeetCode problem/i)
        ).toBeInTheDocument();
      });

      // Chat messages should not be visible
      expect(
        screen.queryByText(/Hello! I'm here to help you practice/i)
      ).not.toBeInTheDocument();
    });
  });

  describe('SUBMISSION_ACCEPTED handling', () => {
    it('opens save modal on accepted submission', async () => {
      mockStorage.get.mockImplementation((keys, callback) => {
        if (keys.includes('currentProblem') || Array.isArray(keys)) {
          callback({
            apiKey: 'test-api-key',
            currentProblem: {
              slug: 'two-sum',
              title: 'Two Sum',
              difficulty: 'Easy',
              tags: ['Array'],
              startAt: Date.now() - 300000, // 5 minutes ago
            },
          });
        } else {
          callback({ apiKey: 'test-api-key' });
        }
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Two Sum')).toBeInTheDocument();
      });

      // Simulate accepted submission
      const msg: SubmissionAcceptedMessage = {
        type: 'SUBMISSION_ACCEPTED',
        slug: 'two-sum',
        submissionId: '123456',
        at: Date.now(),
      };

      await simulateMessage(msg);

      // Save modal should appear
      await waitFor(
        () => {
          expect(screen.getByText(/Mark Complete\?/i)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('ignores submission for different problem', async () => {
      mockStorage.get.mockImplementation((keys, callback) => {
        if (keys.includes('currentProblem') || Array.isArray(keys)) {
          callback({
            apiKey: 'test-api-key',
            currentProblem: {
              slug: 'two-sum',
              title: 'Two Sum',
              difficulty: 'Easy',
              tags: ['Array'],
            },
          });
        } else {
          callback({ apiKey: 'test-api-key' });
        }
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Two Sum')).toBeInTheDocument();
      });

      // Simulate submission for different problem
      const msg: SubmissionAcceptedMessage = {
        type: 'SUBMISSION_ACCEPTED',
        slug: 'three-sum', // Different!
        submissionId: '123456',
        at: Date.now(),
      };

      await simulateMessage(msg);

      // Modal should NOT appear (wait a bit to ensure it doesn't show)
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(screen.queryByText(/Mark Complete\?/i)).not.toBeInTheDocument();
    });
  });

  describe('Message handling edge cases', () => {
    it('ignores malformed messages', async () => {
      mockStorage.get.mockImplementation((keys, callback) => {
        callback({ apiKey: 'test-api-key' });
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Send malformed message
      await simulateMessage({ type: 'UNKNOWN_TYPE', data: 'bad' });
      await simulateMessage(null);
      await simulateMessage('string');

      // Should still show empty state (no crashes)
      expect(
        screen.getByText(/Navigate to a LeetCode problem/i)
      ).toBeInTheDocument();
    });

    it('handles rapid message sequence correctly', async () => {
      mockStorage.get.mockImplementation((keys, callback) => {
        callback({ apiKey: 'test-api-key' });
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Rapid sequence: metadata -> cleared -> metadata
      const msg1: ProblemMetadataMessage = {
        type: 'PROBLEM_METADATA',
        slug: 'two-sum',
        title: 'Two Sum',
        difficulty: 'Easy',
        tags: ['Array'],
      };

      const msg2: ProblemClearedMessage = {
        type: 'PROBLEM_CLEARED',
      };

      const msg3: ProblemMetadataMessage = {
        type: 'PROBLEM_METADATA',
        slug: 'three-sum',
        title: 'Three Sum',
        difficulty: 'Medium',
        tags: ['Array'],
      };

      await simulateMessage(msg1);
      await simulateMessage(msg2);
      await simulateMessage(msg3);

      // Should end up with three-sum displayed
      await waitFor(() => {
        expect(screen.getByText('Three Sum')).toBeInTheDocument();
      });

      expect(screen.queryByText('Two Sum')).not.toBeInTheDocument();
    });

    it('handles problem -> non-problem -> same problem re-entry', async () => {
      mockStorage.get.mockImplementation((keys, callback) => {
        callback({ apiKey: 'test-api-key' });
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      // Step 1: Navigate to problem
      const twoSumMsg: ProblemMetadataMessage = {
        type: 'PROBLEM_METADATA',
        slug: 'two-sum',
        title: 'Two Sum',
        difficulty: 'Easy',
        tags: ['Array'],
      };

      await simulateMessage(twoSumMsg);

      await waitFor(() => {
        expect(screen.getByText('Two Sum')).toBeInTheDocument();
      });

      // Step 2: Leave problem page
      const clearMsg: ProblemClearedMessage = {
        type: 'PROBLEM_CLEARED',
      };

      await simulateMessage(clearMsg);

      await waitFor(() => {
        expect(
          screen.getByText(/Navigate to a LeetCode problem/i)
        ).toBeInTheDocument();
      });

      // Step 3: Return to same problem (re-entry)
      const twoSumReentryMsg: ProblemMetadataMessage = {
        type: 'PROBLEM_METADATA',
        slug: 'two-sum',
        title: 'Two Sum',
        difficulty: 'Easy',
        tags: ['Array'],
      };

      await simulateMessage(twoSumReentryMsg);

      // Should display problem again with fresh state
      await waitFor(() => {
        expect(screen.getByText('Two Sum')).toBeInTheDocument();
      });

      // Chat should be reset with initial greeting
      expect(
        screen.getByText(/Hello! I'm here to help you practice/i)
      ).toBeInTheDocument();
    });
  });

  describe('Submission deduplication', () => {
    it('prevents duplicate save modal for already saved submission ID', async () => {
      const storageData: Record<string, unknown> = {
        apiKey: 'test-api-key',
        currentProblem: {
          slug: 'two-sum',
          title: 'Two Sum',
          difficulty: 'Easy',
          tags: ['Array'],
          startAt: Date.now() - 300000,
        },
      };

      // Mock storage with saved submission
      const savedSubmission = {
        submissionId: '123456',
        at: Date.now() - 60000,
        elapsedSec: 240,
        source: 'auto',
        problem: {
          slug: 'two-sum',
          title: 'Two Sum',
          difficulty: 'Easy',
          tags: ['Array'],
        },
      };

      // Store the submission in v2 format (array)
      storageData['submissions::two-sum'] = [savedSubmission];

      mockStorage.get.mockImplementation((keys, callback) => {
        if (keys === null) {
          callback(storageData);
        } else if (Array.isArray(keys)) {
          const result: Record<string, unknown> = {};
          keys.forEach((key) => {
            if (key in storageData) {
              result[key] = storageData[key];
            }
          });
          callback(result);
        } else if (typeof keys === 'string') {
          callback(keys in storageData ? { [keys]: storageData[keys] } : {});
        } else {
          const result: Record<string, unknown> = { ...keys };
          Object.keys(keys).forEach((key) => {
            if (key in storageData) {
              result[key] = storageData[key];
            }
          });
          callback(result);
        }
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Two Sum')).toBeInTheDocument();
      });

      // Send submission with same ID as already saved
      const msg: SubmissionAcceptedMessage = {
        type: 'SUBMISSION_ACCEPTED',
        slug: 'two-sum',
        submissionId: '123456', // Same as saved!
        at: Date.now(),
      };

      await simulateMessage(msg);

      // Modal should NOT appear (already saved)
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(screen.queryByText(/Mark Complete\?/i)).not.toBeInTheDocument();
    });

    it('allows save modal for different submission ID on same problem', async () => {
      mockStorage.get.mockImplementation((keys, callback) => {
        if (keys.includes('currentProblem') || Array.isArray(keys)) {
          callback({
            apiKey: 'test-api-key',
            currentProblem: {
              slug: 'two-sum',
              title: 'Two Sum',
              difficulty: 'Easy',
              tags: ['Array'],
              startAt: Date.now() - 300000,
            },
          });
        } else {
          callback({ apiKey: 'test-api-key' });
        }
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText('Two Sum')).toBeInTheDocument();
      });

      // First submission
      const msg1: SubmissionAcceptedMessage = {
        type: 'SUBMISSION_ACCEPTED',
        slug: 'two-sum',
        submissionId: '123456',
        at: Date.now(),
      };

      await simulateMessage(msg1);

      // Modal appears
      await waitFor(
        () => {
          expect(screen.getByText(/Mark Complete\?/i)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      // Close modal
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await act(async () => {
        cancelButton.click();
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // Send DIFFERENT submission ID (new attempt)
      const msg2: SubmissionAcceptedMessage = {
        type: 'SUBMISSION_ACCEPTED',
        slug: 'two-sum',
        submissionId: '789012', // Different ID!
        at: Date.now(),
      };

      await simulateMessage(msg2);

      // Modal should appear again for new submission
      await waitFor(
        () => {
          expect(screen.getByText(/Mark Complete\?/i)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });
});
