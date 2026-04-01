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
  InterviewChecklistItem,
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
  type ChatToolRuntime,
  createToolRuntime,
  type RuntimeToolCall,
  type RuntimeToolResponse,
} from '../llm/toolRuntime';

const debug = createLogger('useChatSession');

interface UseChatSessionProps {
  apiKey: string;
  problemSlug: string | undefined;
  problemTitle: string | undefined;
  interviewStage?: InterviewStage;
  interviewStageLabel?: string;
  interviewMissingItems?: string[];
  interviewChecklist?: InterviewChecklistItem[];
  onInterviewStateUpdate?: (update: InterviewStateUpdate) => void;
}

type InterviewEventKind = 'stage_advance' | 'finish_and_rate';

type InterviewToolName =
  | 'set_interview_stage'
  | 'update_interview_checklist'
  | 'complete_interview';

const INTERVIEW_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'set_interview_stage',
    description:
      'Move interview stage forward when candidate progresses to a new phase.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        stage: {
          type: 'string',
          enum: ['before_coding', 'during_coding', 'after_coding'],
        },
        reason: { type: 'string' },
      },
      required: ['stage'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_interview_checklist',
    description:
      'Update one or more interview checklist item statuses with optional evidence.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        updates: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            properties: {
              itemId: { type: 'string' },
              status: { type: 'string', enum: ['pending', 'partial', 'done'] },
              evidence: { type: 'string' },
            },
            required: ['itemId', 'status'],
            additionalProperties: false,
          },
        },
      },
      required: ['updates'],
      additionalProperties: false,
    },
  },
  {
    name: 'complete_interview',
    description:
      'Finalize interview and persist full score breakdown and recommendation.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        score: {
          type: 'object',
          properties: {
            dsa: { type: 'number' },
            communication: { type: 'number' },
            coding: { type: 'number' },
            speed: { type: 'number' },
            testing: { type: 'number' },
            overall: { type: 'number' },
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
          },
          required: [
            'dsa',
            'communication',
            'coding',
            'speed',
            'testing',
            'overall',
            'recommendation',
          ],
          additionalProperties: false,
        },
        summary: { type: 'string' },
      },
      required: ['score'],
      additionalProperties: false,
    },
  },
];

const STAGE_ORDER: InterviewStage[] = [
  'before_coding',
  'during_coding',
  'after_coding',
  'completed',
];

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

type ToolExecutionResult = {
  ok: boolean;
  message: string;
  applied?: Record<string, unknown>;
};

type ParsedChecklistPatch = {
  itemId: string;
  status: 'pending' | 'partial' | 'done';
  evidence?: string;
};

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

function sanitizeAiDisplayText(text: string): string {
  return text
    .replace(/\n?<system-reminder>[\s\S]*?<\/system-reminder>\n?/gi, '\n')
    .trim();
}

function isGemini25Model(modelKey: GeminiModelKey): boolean {
  return GEMINI_MODELS[modelKey].id.startsWith('gemini-2.5-');
}

function canMoveToStage(
  current: InterviewStage,
  next: Exclude<InterviewStage, 'completed'>
): boolean {
  const currentIdx = STAGE_ORDER.indexOf(current);
  const nextIdx = STAGE_ORDER.indexOf(next);
  if (currentIdx === -1 || nextIdx === -1) return false;
  return nextIdx >= currentIdx;
}

function sanitizeToolName(value: unknown): InterviewToolName | null {
  if (value === 'set_interview_stage') return 'set_interview_stage';
  if (value === 'update_interview_checklist')
    return 'update_interview_checklist';
  if (value === 'complete_interview') return 'complete_interview';
  return null;
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') return {};
  return value as Record<string, unknown>;
}

function parseChecklistUpdates(value: unknown): ParsedChecklistPatch[] {
  if (!Array.isArray(value)) return [];
  const parsed = value
    .map((entry) => asObject(entry))
    .map((entry): ParsedChecklistPatch | null => {
      const itemId = entry.itemId;
      const status = entry.status;
      const evidence = entry.evidence;
      if (typeof itemId !== 'string') return null;
      if (status !== 'pending' && status !== 'partial' && status !== 'done') {
        return null;
      }
      return {
        itemId,
        status,
        evidence: typeof evidence === 'string' ? evidence : undefined,
      };
    });

  return parsed.filter((item): item is ParsedChecklistPatch => item !== null);
}

function parseStageCandidate(
  value: unknown
): Exclude<InterviewStage, 'completed'> | null {
  if (value === 'before_coding') return 'before_coding';
  if (value === 'during_coding') return 'during_coding';
  if (value === 'after_coding') return 'after_coding';
  return null;
}

// Typed state boundaries for chat session
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

type HistoryIndexEntry = {
  slug: string;
  lastAccessedAt: number;
};

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

export function useChatSession({
  apiKey,
  problemSlug,
  problemTitle,
  interviewStage,
  interviewStageLabel,
  interviewMissingItems,
  interviewChecklist,
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

  const interviewStageRef = useRef<InterviewStage>(
    interviewStage ?? 'before_coding'
  );
  const interviewChecklistRef = useRef<InterviewChecklistItem[]>(
    interviewChecklist ?? []
  );

  useEffect(() => {
    if (interviewStage) {
      interviewStageRef.current = interviewStage;
    }
  }, [interviewStage]);

  useEffect(() => {
    interviewChecklistRef.current = interviewChecklist ?? [];
  }, [interviewChecklist]);

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
    const checklistGuide = (interviewChecklist ?? [])
      .map(
        (item) => `- ${item.id} [${item.stage}] = ${item.status}: ${item.label}`
      )
      .join('\n');

    const dynamicSystemPrompt = `${SYSTEM_PROMPT}\n\nThe user is currently working on the following problem: "${problemTitle}". Tailor your guidance to this specific problem.\n\nChecklist source of truth:\n${checklistGuide || '- (no checklist loaded)'}\n\nState policy:\n- Keep interview state accurate every turn.\n- When state should change, call a function tool instead of emitting state markup.\n- Use only checklist item IDs from the source-of-truth list.\n- Only move stage forward.`;

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
  }, [
    apiKey,
    problemTitle,
    modelKey,
    thinkingLevel,
    thinkingBudget,
    interviewChecklist,
  ]);

  const applyChecklistToRef = (updates: ParsedChecklistPatch[]) => {
    if (updates.length === 0) return;
    const patchMap = new Map(
      updates.map((patch) => [patch.itemId, patch.status] as const)
    );
    interviewChecklistRef.current = interviewChecklistRef.current.map((item) =>
      patchMap.has(item.id)
        ? { ...item, status: patchMap.get(item.id) ?? item.status }
        : item
    );
  };

  const executeToolCall = (call: RuntimeToolCall): ToolExecutionResult => {
    const toolName = sanitizeToolName(call.name);
    if (!toolName) {
      return { ok: false, message: 'Unknown tool name.' };
    }

    const args = asObject(call.args);

    if (!onInterviewStateUpdate) {
      return {
        ok: false,
        message: 'Interview state update callback unavailable.',
      };
    }

    if (toolName === 'set_interview_stage') {
      const stage = parseStageCandidate(args.stage);
      if (!stage) {
        return { ok: false, message: 'Invalid stage for set_interview_stage.' };
      }

      const currentStage = interviewStageRef.current;
      if (!canMoveToStage(currentStage, stage)) {
        return {
          ok: false,
          message: `Invalid stage transition from ${currentStage} to ${stage}.`,
        };
      }

      onInterviewStateUpdate({
        stage,
        checklist: [],
      });
      interviewStageRef.current = stage;
      return {
        ok: true,
        message: `Interview stage set to ${stage}.`,
        applied: { stage },
      };
    }

    if (toolName === 'update_interview_checklist') {
      const parsedUpdates = parseChecklistUpdates(args.updates);
      if (parsedUpdates.length === 0) {
        return {
          ok: false,
          message: 'No valid checklist updates provided.',
        };
      }

      const validIds = new Set(
        interviewChecklistRef.current.map((item) => item.id)
      );
      const filtered = parsedUpdates.filter((patch) =>
        validIds.has(patch.itemId)
      );

      if (filtered.length === 0) {
        return {
          ok: false,
          message: 'Checklist update item IDs are invalid for current session.',
        };
      }

      const normalized = filtered.map((patch) => {
        const existing = interviewChecklistRef.current.find(
          (item) => item.id === patch.itemId
        );
        if (!existing) return patch;

        if (
          patch.status === 'done' &&
          patch.itemId === 'before_constraints' &&
          existing.status !== 'done'
        ) {
          const evidenceText = (patch.evidence ?? '').toLowerCase();
          const mentionsConstraint =
            evidenceText.includes('constraint') ||
            evidenceText.includes('time') ||
            evidenceText.includes('space');
          const mentionsEdgeCase =
            evidenceText.includes('edge') ||
            evidenceText.includes('case') ||
            evidenceText.includes('empty') ||
            evidenceText.includes('null');

          if (mentionsEdgeCase !== mentionsConstraint) {
            return {
              ...patch,
              status: 'partial' as const,
            };
          }
        }

        return patch;
      });

      onInterviewStateUpdate({
        stage: interviewStageRef.current,
        checklist: normalized,
      });
      applyChecklistToRef(normalized);
      return {
        ok: true,
        message: `Updated ${normalized.length} checklist item(s).`,
        applied: { count: normalized.length },
      };
    }

    const score = parseScoreCandidate(args.score);
    if (!score) {
      return {
        ok: false,
        message: 'Invalid or missing score for complete_interview.',
      };
    }

    onInterviewStateUpdate({
      stage: 'completed',
      checklist: [],
      score: score as InterviewScore,
    });
    interviewStageRef.current = 'completed';

    return {
      ok: true,
      message: 'Interview marked completed with final score.',
      applied: { stage: 'completed', score },
    };
  };

  const sendMessageWithToolLoop = async (
    message: string | Part[],
    opts?: { config?: Record<string, unknown> }
  ) => {
    const runtime = toolRuntimeRef.current;
    if (!runtime) {
      throw new Error('Tool runtime unavailable');
    }

    let response = await runtime.send({
      message,
      config: opts?.config,
    });

    if (!runtime.supportsTools) {
      return response;
    }

    let guard = 0;
    while (response.toolCalls.length > 0 && guard < 8) {
      const functionResponses: RuntimeToolResponse[] = response.toolCalls.map(
        (call) => {
          const outcome = executeToolCall(call);
          return {
            id: call.id,
            name: call.name,
            payload: outcome.ok
              ? {
                  output: outcome,
                }
              : {
                  error: outcome.message,
                },
          };
        }
      );

      response = await runtime.sendToolResponses(functionResponses);
      guard += 1;
    }

    if (guard === 8) {
      debug('Tool loop hit max iterations; returning latest response.');
    }

    return response;
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
      const stageContext = [
        `Current stage: ${interviewStageLabel || 'Before Coding'}`,
        'Current checklist status (use itemId exactly):',
        ...(interviewChecklist ?? []).map(
          (item) =>
            `- ${item.id} [${item.stage}] = ${item.status}: ${item.label}`
        ),
        ...(interviewChecklist && interviewChecklist.length > 0
          ? []
          : ['- none']),
        ...(interviewMissingItems && interviewMissingItems.length > 0
          ? [
              'Missing checklist items:',
              ...interviewMissingItems.map((item) => `- ${item}`),
            ]
          : ['Missing checklist items: none']),
        'Checklist policy: prefer partial when evidence is incomplete. Specifically, before_constraints must only be done when BOTH constraints and edge cases were explicitly discussed.',
        'If interview state changes, call tools. Do not emit custom state markup in response text.',
      ].join('\n');

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
      const aiText = response.text;
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

      const aiMessage: Message = {
        ...aiPlaceholder,
        text: aiText,
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
        : `I manually advanced the interview stage from ${context.previousStageLabel} to ${context.nextStageLabel}.`;

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
              'The interview has been marked complete by the user.',
              'Call complete_interview exactly once with final score, then provide concise final evaluation text.',
              context.scoreSummary
                ? `Current score summary: ${context.scoreSummary}`
                : '',
            ]
              .filter(Boolean)
              .join('\n')
          : [
              `The user manually advanced from ${context.previousStageLabel} to ${context.nextStageLabel}.`,
              'Do not move stage backward.',
              'Acknowledge and ask one focused next-step question.',
            ].join('\n');

      const response = await sendMessageWithToolLoop(instruction);
      const aiText = response.text;
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
