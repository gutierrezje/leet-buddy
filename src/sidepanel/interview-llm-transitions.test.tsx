import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@/test/test-utils';
import App from './App';
import {
  advanceInterviewStage,
  buildFinalAssessmentSummary,
  createInterviewSession,
  getInterviewSessionKey,
  recordInterviewEvidence,
} from './interviewRubric';

const mockSendMessage = vi.fn();
const mockChatsCreate = vi.fn();
const mockGenerateContent = vi.fn();
const mockInteractionsCreate = vi.fn();

vi.mock('@google/genai', () => {
  class GoogleGenAI {
    chats = {
      create: mockChatsCreate,
    };

    models = {
      generateContent: mockGenerateContent,
    };

    interactions = {
      create: mockInteractionsCreate,
    };

    constructor(_args: { apiKey: string }) {}
  }

  return {
    GoogleGenAI,
    FunctionCallingConfigMode: {
      AUTO: 'AUTO',
    },
  };
});

type StorageData = Record<string, unknown>;

function resolveStorageGet(keys: unknown, data: StorageData) {
  if (typeof keys === 'string') {
    return { [keys]: data[keys] };
  }

  if (Array.isArray(keys)) {
    return keys.reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = data[key];
      return acc;
    }, {});
  }

  if (keys && typeof keys === 'object') {
    return Object.entries(keys as Record<string, unknown>).reduce<
      Record<string, unknown>
    >((acc, [key, fallback]) => {
      acc[key] = key in data ? data[key] : fallback;
      return acc;
    }, {});
  }

  return { ...data };
}

function installChromeMocks(storageData: StorageData) {
  const messageListeners: Array<(msg: unknown) => void> = [];
  const storageChangeListeners: Array<
    (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) => void
  > = [];

  const local = {
    get: vi.fn((keys, callback) => {
      callback(resolveStorageGet(keys, storageData));
    }),
    set: vi.fn((items, callback) => {
      Object.assign(storageData, items);
      callback?.();
    }),
    remove: vi.fn((keys, callback) => {
      const keyList = Array.isArray(keys) ? keys : [keys];
      for (const key of keyList) {
        delete storageData[key];
      }
      callback?.();
    }),
  };

  global.chrome = {
    storage: {
      local,
      onChanged: {
        addListener: vi.fn((listener) => {
          storageChangeListeners.push(listener);
        }),
        removeListener: vi.fn((listener) => {
          const index = storageChangeListeners.indexOf(listener);
          if (index >= 0) {
            storageChangeListeners.splice(index, 1);
          }
        }),
      },
    },
    runtime: {
      onMessage: {
        addListener: vi.fn((listener) => {
          messageListeners.push(listener);
        }),
        removeListener: vi.fn((listener) => {
          const index = messageListeners.indexOf(listener);
          if (index >= 0) {
            messageListeners.splice(index, 1);
          }
        }),
      },
      sendMessage: vi.fn(),
      openOptionsPage: vi.fn(),
      id: 'test-extension-id',
      lastError: null,
    },
  } as typeof chrome;

  return { local, messageListeners, storageChangeListeners };
}

function makeTextResponse(text: string) {
  return {
    candidates: [
      {
        content: {
          parts: text ? [{ text }] : [],
        },
      },
    ],
    functionCalls: [],
  };
}

function makeToolResponse(
  calls: Array<{
    id: string;
    name: string;
    args: Record<string, unknown>;
  }>
) {
  return {
    candidates: [
      {
        content: {
          parts: [],
        },
      },
    ],
    functionCalls: calls,
  };
}

function queueChatResponses(responses: unknown[]) {
  mockSendMessage.mockImplementation(async () => {
    const next = responses.shift();
    if (!next) {
      throw new Error('No mock Gemini response queued.');
    }
    return next;
  });
}

function createBaseStorage(
  sessionOverride?: ReturnType<typeof createInterviewSession>
) {
  const slug = 'two-sum';
  const session = sessionOverride ?? createInterviewSession(slug);

  return {
    apiKey: 'test-api-key',
    currentProblem: {
      slug,
      title: 'Two Sum',
      difficulty: 'Easy',
      tags: ['Array', 'Hash Table'],
      startAt: Date.now() - 300000,
    },
    [getInterviewSessionKey(slug)]: session,
  };
}

function createAfterCodingSession() {
  let session = createInterviewSession('two-sum');

  session = recordInterviewEvidence(session, [
    {
      kind: 'problem_restatement',
      source: 'ui',
      snippet: 'Candidate restated the problem in their own words.',
    },
    {
      kind: 'constraints_discussed',
      source: 'ui',
      snippet: 'Candidate asked about input size constraints.',
    },
    {
      kind: 'edge_cases_discussed',
      source: 'ui',
      snippet: 'Candidate covered empty input and duplicates.',
      payload: { edgeCases: ['empty input', 'duplicates'] },
    },
    {
      kind: 'approach_discussed',
      source: 'ui',
      snippet: 'Candidate described a brute force solution.',
      payload: { approach: 'Brute force' },
    },
    {
      kind: 'approach_discussed',
      source: 'ui',
      snippet: 'Candidate described a hash map solution.',
      payload: { approach: 'Hash map' },
    },
    {
      kind: 'multiple_approaches_discussed',
      source: 'ui',
      snippet: 'Candidate compared brute force and hash map tradeoffs.',
    },
    {
      kind: 'complexity_time_discussed',
      source: 'ui',
      snippet: 'Candidate said the time complexity is O(n).',
      payload: { value: 'O(n)' },
    },
    {
      kind: 'complexity_space_discussed',
      source: 'ui',
      snippet: 'Candidate said the space complexity is O(n).',
      payload: { value: 'O(n)' },
    },
  ]);

  session = advanceInterviewStage(
    session,
    'during_coding',
    'ui',
    'Before-coding requirements are satisfied.'
  );

  session = recordInterviewEvidence(session, [
    {
      kind: 'think_aloud',
      source: 'ui',
      snippet: 'Candidate explained each line while coding.',
    },
    {
      kind: 'meaningful_naming',
      source: 'ui',
      snippet: 'Candidate used descriptive names like indexByValue.',
    },
    {
      kind: 'clean_code',
      source: 'ui',
      snippet: 'Candidate kept the implementation clean and linear.',
    },
    {
      kind: 'edge_case_handling',
      source: 'ui',
      snippet: 'Candidate handled missing complements and duplicates.',
    },
  ]);

  return recordInterviewEvidence(session, [
    {
      kind: 'submission_detected',
      source: 'system',
      snippet: 'An accepted submission was detected.',
    },
    {
      kind: 'walkthrough_example',
      source: 'ui',
      snippet: 'Candidate walked through the solution on sample input.',
    },
    {
      kind: 'manual_testing',
      source: 'ui',
      snippet: 'Candidate manually tested edge cases.',
    },
    {
      kind: 'bug_identified',
      source: 'ui',
      snippet: 'Candidate found an off-by-one bug.',
    },
    {
      kind: 'bug_fixed',
      source: 'ui',
      snippet: 'Candidate fixed the loop bound.',
    },
    {
      kind: 'optimization_discussed',
      source: 'ui',
      snippet: 'Candidate discussed memory tradeoffs.',
    },
  ]);
}

describe('Interview LLM state transitions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChatsCreate.mockReturnValue({
      sendMessage: mockSendMessage,
    });
    mockGenerateContent.mockResolvedValue(makeTextResponse('Hint text'));
    mockInteractionsCreate.mockResolvedValue({});
  });

  it('records evidence and advances stages via LLM tool calls', async () => {
    const storageData = createBaseStorage();
    installChromeMocks(storageData);

    queueChatResponses([
      makeToolResponse([
        {
          id: 'call-1',
          name: 'record_interview_evidence',
          args: {
            events: [
              {
                kind: 'problem_restatement',
                snippet: 'Candidate restated the problem clearly.',
                confidence: 0.92,
              },
            ],
          },
        },
      ]),
      makeToolResponse([
        {
          id: 'call-2',
          name: 'record_interview_evidence',
          args: {
            events: [
              {
                kind: 'constraints_discussed',
                snippet: 'Candidate asked about constraints.',
              },
              {
                kind: 'edge_cases_discussed',
                snippet: 'Candidate covered empty input and duplicates.',
                payload: { edgeCases: ['empty input', 'duplicates'] },
              },
              {
                kind: 'approach_discussed',
                snippet: 'Candidate compared brute force and hash map.',
                payload: { approach: 'Hash map' },
              },
              {
                kind: 'multiple_approaches_discussed',
                snippet: 'Candidate compared two viable approaches.',
              },
              {
                kind: 'complexity_time_discussed',
                snippet: 'Candidate said the time complexity is O(n).',
                payload: { value: 'O(n)' },
              },
              {
                kind: 'complexity_space_discussed',
                snippet: 'Candidate said the space complexity is O(n).',
                payload: { value: 'O(n)' },
              },
            ],
          },
        },
      ]),
      makeToolResponse([
        {
          id: 'call-3',
          name: 'suggest_interview_stage',
          args: {
            stage: 'during_coding',
            reason: 'The candidate has satisfied the pre-coding requirements.',
          },
        },
      ]),
      makeTextResponse(
        'GO-AHEAD: You can start coding now. Talk through your implementation.'
      ),
    ]);

    render(<App />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Two Sum')).toBeInTheDocument();
      expect(mockChatsCreate).toHaveBeenCalled();
    });

    const input = screen.getByPlaceholderText('Ask a question...');
    await user.type(
      input,
      'I explained the approach and I am ready to start coding.{enter}'
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          'GO-AHEAD: You can start coding now. Talk through your implementation.'
        )
      ).toBeInTheDocument();
    });

    const storedSession = storageData[
      getInterviewSessionKey('two-sum')
    ] as ReturnType<typeof createInterviewSession>;

    expect(storedSession.derivedState.stage).toBe('during_coding');
    expect(
      storedSession.derivedState.coverage.find(
        (item) => item.id === 'before_restate'
      )?.status
    ).toBe('done');
    expect(
      storedSession.derivedState.coverage.find(
        (item) => item.id === 'before_constraints'
      )?.status
    ).toBe('done');
  });

  it('completes the interview with the recommendation returned by complete_interview', async () => {
    const session = createAfterCodingSession();
    expect(session.derivedState.stage).toBe('after_coding');
    const deterministicAssessment = buildFinalAssessmentSummary(session);
    const storageData = createBaseStorage(session);
    installChromeMocks(storageData);

    queueChatResponses([
      makeToolResponse([
        {
          id: 'complete-1',
          name: 'complete_interview',
          args: {
            recommendation: 'Hire',
            summary: deterministicAssessment.summaryToken,
          },
        },
      ]),
      makeTextResponse(
        'Recommendation: Hire. Good communication and a correct solution.'
      ),
    ]);

    render(<App />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Two Sum')).toBeInTheDocument();
      expect(mockChatsCreate).toHaveBeenCalled();
    });

    await user.click(screen.getByRole('button', { name: 'Interview' }));
    await user.click(screen.getByRole('button', { name: 'Finish & Rate' }));

    await waitFor(() => {
      expect(screen.getByText('Recommendation: Hire')).toBeInTheDocument();
    });

    const storedSession = storageData[
      getInterviewSessionKey('two-sum')
    ] as ReturnType<typeof createInterviewSession>;

    expect(storedSession.derivedState.stage).toBe('completed');
    expect(storedSession.finalAssessment?.recommendation).toBe('Hire');
    expect(storedSession.finalAssessment?.rationale).toContain(
      'Recommendation: Hire.'
    );
    expect(mockSendMessage).toHaveBeenCalledTimes(2);

    const firstPrompt = mockSendMessage.mock.calls[0]?.[0]?.message;
    expect(firstPrompt).toContain('Deterministic assessment token');
    expect(firstPrompt).toContain(deterministicAssessment.summaryToken);
  });

  it('falls back to the deterministic completion message when the LLM does not call complete_interview', async () => {
    const session = createAfterCodingSession();
    expect(session.derivedState.stage).toBe('after_coding');
    const deterministicAssessment = buildFinalAssessmentSummary(session);
    const storageData = createBaseStorage(session);
    installChromeMocks(storageData);

    queueChatResponses([
      makeTextResponse(
        'I apologize, it seems I encountered an internal issue when trying to finalize the interview.'
      ),
    ]);

    render(<App />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Two Sum')).toBeInTheDocument();
      expect(mockChatsCreate).toHaveBeenCalled();
    });

    await user.click(screen.getByRole('button', { name: 'Interview' }));
    await user.click(screen.getByRole('button', { name: 'Finish & Rate' }));
    await user.click(screen.getByRole('button', { name: 'Chat' }));

    await waitFor(() => {
      expect(
        screen.getByText(
          `Interview completed. Recommendation: ${deterministicAssessment.recommendation}.`
        )
      ).toBeInTheDocument();
    });

    expect(
      screen.queryByText(/encountered an internal issue/i)
    ).not.toBeInTheDocument();

    const storedSession = storageData[
      getInterviewSessionKey('two-sum')
    ] as ReturnType<typeof createInterviewSession>;

    expect(storedSession.derivedState.stage).toBe('completed');
    expect(storedSession.finalAssessment?.recommendation).toBe(
      deterministicAssessment.recommendation
    );
  });
});
