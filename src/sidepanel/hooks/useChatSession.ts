import {
  type Chat,
  FunctionCallingConfigMode,
  type FunctionDeclaration,
  GoogleGenAI,
  type Part,
} from '@google/genai';
import { useEffect, useReducer, useRef, useState } from 'react';
import {
  CHAT_HISTORY_INDEX_KEY,
  getChatHistoryKey,
  MAX_CHAT_HISTORY_PROBLEMS,
  MAX_MESSAGES_PER_PROBLEM,
} from '@/shared/chatHistory';
import type {
  CurrentCodeSnapshot,
  DerivedFinalAssessment,
  DerivedInterviewState,
  InterviewEvidenceInput,
  InterviewEvidenceKind,
  InterviewScore,
  InterviewStage,
  InterviewStateUpdate,
  Message,
} from '@/shared/types';
import { createLogger } from '@/shared/utils/debug';
import {
  GEMINI_MODELS,
  type GeminiModelKey,
  HINT_SYSTEM_PROMPT,
  SYSTEM_PROMPT,
  THINKING_BUDGETS,
  type ThinkingBudgetKey,
  type ThinkingLevel,
} from '../config';
import initialMessages from '../data/messages.json';
import {
  INTERVIEW_EVIDENCE_KINDS,
  parseFinalAssessmentToken,
} from '../interviewRubric';
import {
  type ChatToolRuntime,
  createToolRuntime,
  type RuntimeResponse,
  type RuntimeToolCall,
  type RuntimeToolResponse,
} from '../llm/toolRuntime';

const debug = createLogger('useChatSession');

interface UseChatSessionProps {
  apiKey: string;
  problemSlug: string | undefined;
  problemTitle: string | undefined;
  interviewState?: DerivedInterviewState;
  finalAssessment?: DerivedFinalAssessment;
  onInterviewStateUpdate?: (update: InterviewStateUpdate) => void;
}

type InterviewEventKind = 'stage_advance' | 'finish_and_rate';

type InterviewToolName =
  | 'record_interview_evidence'
  | 'suggest_interview_stage'
  | 'complete_interview';

const INTERVIEW_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'record_interview_evidence',
    description:
      'Capture one or more normalized observations about the candidate or interview state.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        events: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            properties: {
              kind: {
                type: 'string',
                enum: INTERVIEW_EVIDENCE_KINDS,
              },
              stageHint: {
                type: 'string',
                enum: ['before_coding', 'during_coding', 'after_coding'],
              },
              snippet: { type: 'string' },
              confidence: { type: 'number' },
              payload: {
                type: 'object',
                additionalProperties: true,
              },
            },
            required: ['kind', 'snippet'],
            additionalProperties: false,
          },
        },
      },
      required: ['events'],
      additionalProperties: false,
    },
  },
  {
    name: 'suggest_interview_stage',
    description:
      'Suggest moving the interview stage forward once the current stage has enough evidence.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        stage: {
          type: 'string',
          enum: ['during_coding', 'after_coding'],
        },
        reason: { type: 'string' },
      },
      required: ['stage'],
      additionalProperties: false,
    },
  },
  {
    name: 'complete_interview',
    description:
      'Finalize the interview with a bounded recommendation using the deterministic assessment token.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        recommendation: {
          type: 'string',
          enum: [
            'Strong Hire',
            'Hire',
            'Weak Hire',
            'Weak Reject',
            'Reject',
            'Strong Reject',
          ],
        },
        summary: { type: 'string' },
      },
      required: ['recommendation', 'summary'],
      additionalProperties: false,
    },
  },
];

type ToolExecutionResult = {
  ok: boolean;
  message: string;
  applied?: Record<string, unknown>;
};

type ExecutedToolResult = {
  name: string;
  ok: boolean;
};

type ToolLoopResult = RuntimeResponse & {
  executedTools: ExecutedToolResult[];
};

type ParsedFinalScore = {
  dsa: number;
  communication: number;
  coding: number;
  speed: number;
  testing: number;
  overall: number;
  recommendation:
    | 'Strong Hire'
    | 'Hire'
    | 'Weak Hire'
    | 'Weak Reject'
    | 'Reject'
    | 'Strong Reject';
};

type HistoryIndexEntry = {
  slug: string;
  lastAccessedAt: number;
};

type EvidencePayload = Record<string, string | number | boolean | string[]>;

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') return {};
  return value as Record<string, unknown>;
}

function sanitizeAiDisplayText(text: string): string {
  return text.trim();
}

function buildCompletionFallbackMessage(
  assessment?: Pick<InterviewScore, 'recommendation'>
): string {
  if (!assessment) return 'Interview completed.';
  return `Interview completed. Recommendation: ${assessment.recommendation}.`;
}

function parseRecommendationCandidate(
  value: unknown
): InterviewScore['recommendation'] | null {
  if (value === 'Strong Hire') return 'Strong Hire';
  if (value === 'Hire') return 'Hire';
  if (value === 'Weak Hire') return 'Weak Hire';
  if (value === 'Weak Reject') return 'Weak Reject';
  if (value === 'Reject') return 'Reject';
  if (value === 'Strong Reject') return 'Strong Reject';
  return null;
}

function parseScoreCandidate(value: unknown): ParsedFinalScore | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const parsed = value as ParsedFinalScore;
  const verdicts = new Set([
    'Strong Hire',
    'Hire',
    'Weak Hire',
    'Weak Reject',
    'Reject',
    'Strong Reject',
  ]);

  if (!verdicts.has(parsed.recommendation)) return undefined;

  const numericKeys: Array<keyof Omit<ParsedFinalScore, 'recommendation'>> = [
    'dsa',
    'communication',
    'coding',
    'speed',
    'testing',
    'overall',
  ];

  for (const key of numericKeys) {
    const valueAtKey = parsed[key];
    if (typeof valueAtKey !== 'number' || Number.isNaN(valueAtKey)) {
      return undefined;
    }
  }

  return parsed;
}

function sanitizeToolName(value: unknown): InterviewToolName | null {
  if (value === 'record_interview_evidence') return 'record_interview_evidence';
  if (value === 'suggest_interview_stage') return 'suggest_interview_stage';
  if (value === 'complete_interview') return 'complete_interview';
  return null;
}

function parseStageCandidate(
  value: unknown
): Exclude<InterviewStage, 'before_coding' | 'completed'> | null {
  if (value === 'during_coding') return 'during_coding';
  if (value === 'after_coding') return 'after_coding';
  return null;
}

function sanitizePayload(value: unknown): EvidencePayload | undefined {
  const payload = asObject(value);
  const entries = Object.entries(payload).filter(([, entryValue]) => {
    if (typeof entryValue === 'string') return true;
    if (typeof entryValue === 'number') return true;
    if (typeof entryValue === 'boolean') return true;
    if (Array.isArray(entryValue)) {
      return entryValue.every((item) => typeof item === 'string');
    }
    return false;
  });

  if (entries.length === 0) return undefined;
  return Object.fromEntries(entries) as EvidencePayload;
}

function parseEvidenceEvents(value: unknown): InterviewEvidenceInput[] {
  if (!Array.isArray(value)) return [];

  const kinds = new Set(INTERVIEW_EVIDENCE_KINDS);

  return value
    .map((entry) => asObject(entry))
    .map((entry): InterviewEvidenceInput | null => {
      const kind = entry.kind;
      const stageHint = entry.stageHint;
      const snippet = entry.snippet;
      const confidence = entry.confidence;

      if (
        typeof kind !== 'string' ||
        !kinds.has(kind as InterviewEvidenceKind)
      ) {
        return null;
      }
      if (typeof snippet !== 'string' || snippet.trim().length === 0) {
        return null;
      }

      return {
        kind: kind as InterviewEvidenceKind,
        stageHint:
          stageHint === 'before_coding' ||
          stageHint === 'during_coding' ||
          stageHint === 'after_coding'
            ? stageHint
            : undefined,
        snippet,
        confidence:
          typeof confidence === 'number'
            ? Math.max(0, Math.min(1, confidence))
            : 0.75,
        payload: sanitizePayload(entry.payload),
      };
    })
    .filter((event): event is InterviewEvidenceInput => event !== null);
}

function isGemini25Model(modelKey: GeminiModelKey): boolean {
  return GEMINI_MODELS[modelKey].id.startsWith('gemini-2.5-');
}

function buildThinkingConfig(
  modelKey: GeminiModelKey,
  thinkingLevel: ThinkingLevel,
  thinkingBudget: ThinkingBudgetKey
): Record<string, unknown> | undefined {
  const model = GEMINI_MODELS[modelKey];
  if (!model.supportsThinking) return undefined;

  if (model.thinkingType === 'level') {
    return { thinkingLevel };
  }
  return { thinkingBudget: THINKING_BUDGETS[thinkingBudget].value };
}

function buildHintThinkingConfig(
  modelKey: GeminiModelKey
): Record<string, unknown> | undefined {
  const model = GEMINI_MODELS[modelKey];
  if (!model.supportsThinking) return undefined;

  if (model.thinkingType === 'level') {
    return { thinkingLevel: 'minimal' };
  }
  return { thinkingBudget: 1024 };
}

function sanitizeHistoryMessages(value: unknown): Message[] {
  if (!Array.isArray(value)) return [];

  const safeMessages = value.filter(
    (msg): msg is Message =>
      typeof msg === 'object' &&
      msg !== null &&
      typeof msg.id === 'string' &&
      typeof msg.sender === 'string' &&
      typeof msg.text === 'string' &&
      typeof msg.timestamp === 'number'
  );

  return safeMessages.slice(-MAX_MESSAGES_PER_PROBLEM);
}

function sanitizeHistoryIndex(value: unknown): HistoryIndexEntry[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(
      (entry): entry is HistoryIndexEntry =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof entry.slug === 'string' &&
        typeof entry.lastAccessedAt === 'number'
    )
    .sort((a, b) => b.lastAccessedAt - a.lastAccessedAt);
}

function upsertHistoryIndex(
  currentIndex: HistoryIndexEntry[],
  problemSlug: string
): HistoryIndexEntry[] {
  const now = Date.now();
  const withoutSlug = currentIndex.filter(
    (entry) => entry.slug !== problemSlug
  );
  return [{ slug: problemSlug, lastAccessedAt: now }, ...withoutSlug].slice(
    0,
    MAX_CHAT_HISTORY_PROBLEMS
  );
}

function getEvictedSlugs(
  previousIndex: HistoryIndexEntry[],
  nextIndex: HistoryIndexEntry[]
): string[] {
  const nextSet = new Set(nextIndex.map((entry) => entry.slug));
  return previousIndex
    .map((entry) => entry.slug)
    .filter((slug) => !nextSet.has(slug));
}

function buildInterviewPromptPreamble(problemTitle: string): string {
  return [
    SYSTEM_PROMPT.trim(),
    '',
    `The user is currently working on the following problem: "${problemTitle}".`,
    'Interview tool policy:',
    '- Use record_interview_evidence whenever the candidate demonstrates a concrete signal.',
    '- Prefer normalized evidence over rubric updates or prose-only state.',
    '- Use suggest_interview_stage only when the current stage is truly complete.',
    '- Use complete_interview only when the user explicitly finishes the interview.',
    '- Ask exactly one focused question per turn; never ask compound questions.',
    '- Do not validate guessed claims; probe and verify assumptions first.',
    '- If candidate language signals uncertainty, ask one validation probe before progressing.',
    '- Record uncertainty with uncertainty_signal whenever confidence is low or wording is tentative.',
    '- Record hint_required each time you provide a substantive hint to unblock progress.',
    '- Record core_logic_correction when you must fix or correct core algorithm reasoning.',
    '- Do not move to the next stage until current checkpoint evidence is sufficient.',
    '- During coding, enforce stepwise implementation and redirect full-solution dumps.',
    '- In post-solution discussion, ask about optimization first; if low-signal, ask one variation/twist question.',
    '- If the candidate dismisses an optimization as too hard or unclear, require a conceptual attempt.',
    '- Downgrade final scoring when hints/corrections were required to reach completion.',
    '- Keep recommendation calibration conservative when core logic needed repeated correction.',
    'Normalized evidence kinds:',
    ...INTERVIEW_EVIDENCE_KINDS.map((kind) => `- ${kind}`),
    'Payload hints:',
    '- For approaches, use payload.approach when possible.',
    '- For complexity, use payload.value with the claimed complexity.',
    '- For edge cases, use payload.edgeCases with concise examples.',
    '- For uncertainty/hints/corrections, include payload.category when useful (complexity, approach, coding, testing).',
  ].join('\n');
}

function buildStatePacket(state?: DerivedInterviewState): string {
  if (!state) {
    return [
      'Current interview state: Before Coding',
      'No interview evidence has been stored yet.',
      'Preferred next focus: establish the candidate’s understanding before coding.',
    ].join('\n');
  }

  return [
    `Current interview state: ${state.stageLabel}`,
    `Preferred next focus: ${state.nextFollowUp ?? 'Continue naturally based on the candidate’s latest answer.'}`,
    'Already acknowledged accomplishments:',
    ...(state.acknowledgedAccomplishments.length > 0
      ? state.acknowledgedAccomplishments.map((item) => `- ${item}`)
      : ['- none']),
    'Observed strengths:',
    ...(state.strengths.length > 0
      ? state.strengths.map((item) => `- ${item}`)
      : ['- none']),
    'Current gaps:',
    ...(state.missingAreas.length > 0
      ? state.missingAreas.map((item) => `- ${item}`)
      : ['- none']),
    'Recent high-signal evidence:',
    ...(state.recentEvidence.length > 0
      ? state.recentEvidence.map((item) => `- ${item}`)
      : ['- none']),
    state.approachSummary.selected
      ? `Chosen approach: ${state.approachSummary.selected}`
      : 'Chosen approach: not yet established',
    state.complexityClaims.time
      ? `Time complexity claimed: ${state.complexityClaims.time}`
      : 'Time complexity claimed: not yet established',
    state.complexityClaims.space
      ? `Space complexity claimed: ${state.complexityClaims.space}`
      : 'Space complexity claimed: not yet established',
    state.edgeCasesMentioned.length > 0
      ? `Edge cases mentioned: ${state.edgeCasesMentioned.join('; ')}`
      : 'Edge cases mentioned: none captured yet',
    'If you capture new evidence or decide the stage is ready to move forward, call a tool.',
  ].join('\n');
}

type ChatState =
  | { status: 'idle' }
  | { status: 'initializing' }
  | { status: 'ready' }
  | { status: 'sending'; pendingMessageId: string }
  | { status: 'error'; error: string };

type ChatAction =
  | { type: 'INITIALIZE_START' }
  | { type: 'INITIALIZE_SUCCESS' }
  | { type: 'CLEAR' }
  | { type: 'SEND_START'; pendingMessageId: string }
  | { type: 'SEND_SUCCESS' }
  | { type: 'SEND_ERROR'; error: string };

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'INITIALIZE_START':
      return { status: 'initializing' };
    case 'INITIALIZE_SUCCESS':
      return { status: 'ready' };
    case 'CLEAR':
      return { status: 'idle' };
    case 'SEND_START':
      return { status: 'sending', pendingMessageId: action.pendingMessageId };
    case 'SEND_SUCCESS':
      return { status: 'ready' };
    case 'SEND_ERROR':
      return { status: 'error', error: action.error };
    default:
      return state;
  }
}

export function useChatSession({
  apiKey,
  problemSlug,
  problemTitle,
  interviewState,
  finalAssessment,
  onInterviewStateUpdate,
}: UseChatSessionProps) {
  const [messages, setMessages] = useState<Message[]>(
    initialMessages as Message[]
  );
  const [chatSession, setChatSession] = useState<Chat | null>(null);
  const toolRuntimeRef = useRef<ChatToolRuntime | null>(null);
  const [state, dispatch] = useReducer(chatReducer, { status: 'idle' });
  const [input, setInput] = useState('');
  const aiRef = useRef<GoogleGenAI | null>(null);
  const [modelKey, setModelKey] = useState<GeminiModelKey>('2.5-flash');
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>('medium');
  const [thinkingBudget, setThinkingBudget] =
    useState<ThinkingBudgetKey>('medium');
  const interviewStateRef = useRef<DerivedInterviewState | undefined>(
    interviewState
  );
  const finalAssessmentRef = useRef<DerivedFinalAssessment | undefined>(
    finalAssessment
  );

  useEffect(() => {
    interviewStateRef.current = interviewState;
  }, [interviewState]);

  useEffect(() => {
    finalAssessmentRef.current = finalAssessment;
  }, [finalAssessment]);

  useEffect(() => {
    if (!problemSlug) return;

    const historyKey = getChatHistoryKey(problemSlug);
    chrome.storage.local.get([historyKey], (data) => {
      const safeMessages = sanitizeHistoryMessages(data[historyKey]);
      if (safeMessages.length === 0) {
        setMessages(initialMessages as Message[]);
        return;
      }

      setMessages(safeMessages);
    });
  }, [problemSlug]);

  useEffect(() => {
    if (!problemSlug) return;
    const historyKey = getChatHistoryKey(problemSlug);

    chrome.storage.local.get([CHAT_HISTORY_INDEX_KEY], (data) => {
      const currentIndex = sanitizeHistoryIndex(data[CHAT_HISTORY_INDEX_KEY]);
      const nextIndex = upsertHistoryIndex(currentIndex, problemSlug);
      const evictedSlugs = getEvictedSlugs(currentIndex, nextIndex);

      const payload: Record<string, unknown> = {
        [historyKey]: messages.slice(-MAX_MESSAGES_PER_PROBLEM),
        [CHAT_HISTORY_INDEX_KEY]: nextIndex,
      };

      chrome.storage.local.set(payload, () => {
        if (chrome.runtime.lastError) return;
        if (evictedSlugs.length === 0) return;

        const keysToRemove = evictedSlugs.map((slug) =>
          getChatHistoryKey(slug)
        );
        chrome.storage.local.remove(
          keysToRemove,
          () => void chrome.runtime.lastError
        );
      });
    });
  }, [problemSlug, messages]);

  useEffect(() => {
    chrome.storage.local.get(
      ['geminiModel', 'thinkingLevel', 'thinkingBudget'],
      (data) => {
        if (data.geminiModel) {
          setModelKey(data.geminiModel as GeminiModelKey);
        }
        if (data.thinkingLevel) {
          setThinkingLevel(data.thinkingLevel as ThinkingLevel);
        }
        if (data.thinkingBudget) {
          setThinkingBudget(data.thinkingBudget as ThinkingBudgetKey);
        }
      }
    );
  }, []);

  useEffect(() => {
    if (!apiKey || !problemTitle) {
      setChatSession(null);
      toolRuntimeRef.current = null;
      dispatch({ type: 'CLEAR' });
      return;
    }

    const toolCallingEnabled = isGemini25Model(modelKey);
    debug(
      'Initializing chat session for %s (tool calling: %s)',
      problemTitle,
      toolCallingEnabled ? 'enabled' : 'disabled'
    );
    dispatch({ type: 'INITIALIZE_START' });

    const ai = new GoogleGenAI({ apiKey });
    aiRef.current = ai;

    const modelId = GEMINI_MODELS[modelKey].id;
    const dynamicSystemPrompt = buildInterviewPromptPreamble(problemTitle);
    const thinkingConfig = buildThinkingConfig(
      modelKey,
      thinkingLevel,
      thinkingBudget
    );

    const newChat = ai.chats.create({
      model: modelId,
      config: {
        systemInstruction: dynamicSystemPrompt,
        thinkingConfig,
        ...(toolCallingEnabled
          ? {
              tools: [
                {
                  functionDeclarations: INTERVIEW_TOOL_DECLARATIONS,
                },
              ],
              toolConfig: {
                functionCallingConfig: {
                  mode: FunctionCallingConfigMode.AUTO,
                },
              },
            }
          : {}),
      },
    });

    setChatSession(newChat);
    toolRuntimeRef.current = createToolRuntime({
      modelKey,
      modelId,
      chat: newChat,
      ai,
      systemInstruction: dynamicSystemPrompt,
      toolDeclarations: INTERVIEW_TOOL_DECLARATIONS,
    });
    dispatch({ type: 'INITIALIZE_SUCCESS' });
  }, [apiKey, problemTitle, modelKey, thinkingLevel, thinkingBudget]);

  const executeToolCall = (call: RuntimeToolCall): ToolExecutionResult => {
    const toolName = sanitizeToolName(call.name);
    if (!toolName) {
      return { ok: false, message: 'Unknown tool name.' };
    }

    if (!onInterviewStateUpdate) {
      return {
        ok: false,
        message: 'Interview state update callback unavailable.',
      };
    }

    const args = asObject(call.args);

    if (toolName === 'record_interview_evidence') {
      const parsedEvents = parseEvidenceEvents(args.events).map((event) => ({
        ...event,
        source: 'llm' as const,
      }));
      if (parsedEvents.length === 0) {
        return { ok: false, message: 'No valid evidence events provided.' };
      }

      onInterviewStateUpdate({
        events: parsedEvents,
      });
      return {
        ok: true,
        message: `Recorded ${parsedEvents.length} evidence event(s).`,
        applied: { count: parsedEvents.length },
      };
    }

    if (toolName === 'suggest_interview_stage') {
      const stage = parseStageCandidate(args.stage);
      if (!stage) {
        return {
          ok: false,
          message: 'Invalid stage for suggest_interview_stage.',
        };
      }

      onInterviewStateUpdate({
        suggestedStage: stage,
        stageReason:
          typeof args.reason === 'string'
            ? args.reason
            : `Suggested transition to ${stage}.`,
      });
      return {
        ok: true,
        message: `Suggested interview stage transition to ${stage}.`,
        applied: { stage },
      };
    }

    const recommendation = parseRecommendationCandidate(args.recommendation);
    if (!recommendation) {
      return {
        ok: false,
        message:
          'Missing or invalid recommendation for complete_interview tool call.',
      };
    }

    const summary =
      typeof args.summary === 'string'
        ? parseFinalAssessmentToken(args.summary)
        : null;
    const resolvedAssessment = summary ?? finalAssessmentRef.current;
    const parsedScore = parseScoreCandidate(resolvedAssessment);
    if (!parsedScore) {
      return {
        ok: false,
        message:
          'Missing deterministic assessment context for complete_interview.',
      };
    }

    onInterviewStateUpdate({
      finalRecommendation: recommendation,
    });

    return {
      ok: true,
      message: 'Interview marked completed with bounded recommendation.',
      applied: {
        recommendation,
      },
    };
  };

  const sendMessageWithToolLoop = async (
    message: string | Part[],
    opts?: { config?: Record<string, unknown> }
  ): Promise<ToolLoopResult> => {
    const runtime = toolRuntimeRef.current;
    if (!runtime) {
      throw new Error('Tool runtime unavailable');
    }

    let response = await runtime.send({
      message,
      config: opts?.config,
    });
    const executedTools: ExecutedToolResult[] = [];

    if (!runtime.supportsTools) {
      return {
        ...response,
        executedTools,
      };
    }

    let guard = 0;
    while (response.toolCalls.length > 0 && guard < 8) {
      const functionResponses: RuntimeToolResponse[] = response.toolCalls.map(
        (call) => {
          const outcome = executeToolCall(call);
          executedTools.push({
            name: call.name,
            ok: outcome.ok,
          });
          return {
            id: call.id,
            name: call.name,
            payload: outcome.ok
              ? { output: outcome }
              : { error: outcome.message },
          };
        }
      );

      response = await runtime.sendToolResponses(functionResponses);
      guard += 1;
    }

    if (guard === 8) {
      debug('Tool loop hit max iterations; returning latest response.');
    }

    return {
      ...response,
      executedTools,
    };
  };

  const handleSendMessage = async (
    messageText: string,
    displayText?: string,
    options?: { codeSnapshot?: CurrentCodeSnapshot }
  ) => {
    const userDisplayMessage = displayText || messageText;

    if (!messageText.trim() || state.status !== 'ready' || !chatSession) {
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: userDisplayMessage,
      timestamp: Date.now(),
    };

    const aiPlaceholder: Message = {
      id: (Date.now() + 1).toString(),
      sender: 'ai',
      text: '',
      timestamp: Date.now() + 1,
      isLoading: true,
    };

    dispatch({ type: 'SEND_START', pendingMessageId: aiPlaceholder.id });

    setMessages((prevMessages) => [
      ...prevMessages,
      userMessage,
      aiPlaceholder,
    ]);
    setInput('');

    try {
      const attachedCode = options?.codeSnapshot;
      const stageContext = buildStatePacket(interviewStateRef.current);

      const messageForModel = attachedCode
        ? [
            stageContext,
            '',
            'Code context for this turn:',
            `Problem slug: ${attachedCode.slug}`,
            `Language: ${attachedCode.language || 'unknown'}`,
            `Captured from: ${attachedCode.source}`,
            `Captured at: ${new Date(attachedCode.at).toISOString()}`,
            '',
            '```',
            attachedCode.code,
            '```',
            '',
            `User request: ${messageText}`,
          ].join('\n')
        : `${stageContext}\n\nUser request: ${messageText}`;

      const response = await sendMessageWithToolLoop(messageForModel);
      const aiText = response.text ?? '';
      const cleanAiText = sanitizeAiDisplayText(aiText);

      const aiMessage: Message = {
        ...aiPlaceholder,
        text: cleanAiText || aiText,
        isLoading: false,
      };

      setMessages((prev) =>
        prev.map((msg) => (msg.id === aiPlaceholder.id ? aiMessage : msg))
      );
      dispatch({ type: 'SEND_SUCCESS' });
    } catch (error) {
      debug('Error sending message to AI: %O', error);
      const errorMessage: Message = {
        ...aiPlaceholder,
        text: 'Sorry, I encountered an error. Please check your API key or network connection and try again.',
        isLoading: false,
      };

      setMessages((prev) =>
        prev.map((msg) => (msg.id === aiPlaceholder.id ? errorMessage : msg))
      );
      dispatch({
        type: 'SEND_ERROR',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const handleSendHint = async (hintQuestion: string, displayText: string) => {
    if (state.status !== 'ready' || !aiRef.current || !problemTitle) {
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: displayText,
      timestamp: Date.now(),
      isHint: true,
    };

    const aiPlaceholder: Message = {
      id: (Date.now() + 1).toString(),
      sender: 'ai',
      text: '',
      timestamp: Date.now() + 1,
      isLoading: true,
      isHint: true,
    };

    dispatch({ type: 'SEND_START', pendingMessageId: aiPlaceholder.id });

    setMessages((prevMessages) => [
      ...prevMessages,
      userMessage,
      aiPlaceholder,
    ]);

    try {
      const modelId = GEMINI_MODELS[modelKey].id;
      const hintSystemPrompt = `${HINT_SYSTEM_PROMPT}\n\nThe user is working on: "${problemTitle}"`;
      const thinkingConfig = buildHintThinkingConfig(modelKey);

      const response = await aiRef.current.models.generateContent({
        model: modelId,
        contents: hintQuestion,
        config: {
          systemInstruction: hintSystemPrompt,
          thinkingConfig,
        },
      });
      const aiText = response.text ?? '';
      const cleanAiText = sanitizeAiDisplayText(aiText);

      const aiMessage: Message = {
        ...aiPlaceholder,
        text: cleanAiText || aiText,
        isLoading: false,
      };

      setMessages((prev) =>
        prev.map((msg) => (msg.id === aiPlaceholder.id ? aiMessage : msg))
      );
      dispatch({ type: 'SEND_SUCCESS' });
    } catch (error) {
      debug('Error sending hint request: %O', error);
      const errorMessage: Message = {
        ...aiPlaceholder,
        text: 'Sorry, I encountered an error fetching the hint. Please try again.',
        isLoading: false,
      };

      setMessages((prev) =>
        prev.map((msg) => (msg.id === aiPlaceholder.id ? errorMessage : msg))
      );
      dispatch({
        type: 'SEND_ERROR',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const handleInterviewEvent = async (
    kind: InterviewEventKind,
    context: {
      previousStageLabel: string;
      nextStageLabel?: string;
      scoreSummary?: string;
    }
  ) => {
    if (state.status !== 'ready' || !chatSession || !problemTitle) return;

    const userText =
      kind === 'finish_and_rate'
        ? 'Finish and rate this interview now.'
        : `The interview stage changed from ${context.previousStageLabel} to ${context.nextStageLabel}.`;

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: userText,
      timestamp: Date.now(),
    };

    const aiPlaceholder: Message = {
      id: (Date.now() + 1).toString(),
      sender: 'ai',
      text: '',
      timestamp: Date.now() + 1,
      isLoading: true,
    };

    dispatch({ type: 'SEND_START', pendingMessageId: aiPlaceholder.id });
    setMessages((prevMessages) => [
      ...prevMessages,
      userMessage,
      aiPlaceholder,
    ]);

    try {
      const instruction =
        kind === 'finish_and_rate'
          ? [
              buildStatePacket(interviewStateRef.current),
              '',
              'The interview has been marked complete by the user.',
              'Call complete_interview exactly once with recommendation and summary.',
              'Use the deterministic assessment token below in the summary field verbatim.',
              context.scoreSummary
                ? `Deterministic assessment token: ${context.scoreSummary}`
                : '',
            ]
              .filter(Boolean)
              .join('\n')
          : [
              buildStatePacket(interviewStateRef.current),
              '',
              `The interview stage changed from ${context.previousStageLabel} to ${context.nextStageLabel}.`,
              'Acknowledge the transition and ask one focused next-step question.',
            ].join('\n');

      const response = await sendMessageWithToolLoop(instruction);
      const aiText = response.text ?? '';
      const cleanAiText = sanitizeAiDisplayText(aiText);
      const completedViaTool = response.executedTools.some(
        (tool: ExecutedToolResult) =>
          tool.name === 'complete_interview' && tool.ok
      );
      const displayText =
        kind === 'finish_and_rate'
          ? completedViaTool && cleanAiText
            ? cleanAiText
            : buildCompletionFallbackMessage(finalAssessmentRef.current)
          : cleanAiText || aiText;

      if (kind === 'finish_and_rate' && completedViaTool && cleanAiText) {
        onInterviewStateUpdate?.({
          finalRationale: cleanAiText,
        });
      }

      if (kind === 'finish_and_rate' && !completedViaTool) {
        debug(
          'Finish event completed without successful complete_interview tool call; using fallback message.'
        );
      }

      const aiMessage: Message = {
        ...aiPlaceholder,
        text: displayText,
        isLoading: false,
      };

      setMessages((prev) =>
        prev.map((msg) => (msg.id === aiPlaceholder.id ? aiMessage : msg))
      );
      dispatch({ type: 'SEND_SUCCESS' });
    } catch (error) {
      debug('Error sending interview event: %O', error);
      const errorMessage: Message = {
        ...aiPlaceholder,
        text: 'Sorry, I could not generate the interview update message. Please try again.',
        isLoading: false,
      };

      setMessages((prev) =>
        prev.map((msg) => (msg.id === aiPlaceholder.id ? errorMessage : msg))
      );
      dispatch({
        type: 'SEND_ERROR',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const isReady = state.status === 'ready';
  const loading = state.status === 'initializing' || state.status === 'sending';

  const clearCurrentProblemHistory = () => {
    if (!problemSlug) return;

    const historyKey = getChatHistoryKey(problemSlug);
    chrome.storage.local.remove(
      historyKey,
      () => void chrome.runtime.lastError
    );
    const seed = initialMessages as Message[];
    setMessages(seed);
  };

  return {
    messages,
    loading,
    input,
    setInput,
    handleSendMessage,
    handleSendHint,
    handleInterviewEvent,
    isReady,
    clearCurrentProblemHistory,
  };
}
