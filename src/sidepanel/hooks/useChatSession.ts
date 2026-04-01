import { type Chat, GoogleGenAI } from '@google/genai';
import { useEffect, useReducer, useRef, useState } from 'react';
import {
  CHAT_HISTORY_INDEX_KEY,
  getChatHistoryKey,
  MAX_CHAT_HISTORY_PROBLEMS,
  MAX_MESSAGES_PER_PROBLEM,
} from '@/shared/chatHistory';
import type { CurrentCodeSnapshot, Message } from '@/shared/types';
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

const debug = createLogger('useChatSession');

interface UseChatSessionProps {
  apiKey: string;
  problemSlug: string | undefined;
  problemTitle: string | undefined;
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
}: UseChatSessionProps) {
  const [messages, setMessages] = useState<Message[]>(
    initialMessages as Message[]
  );
  const [chatSession, setChatSession] = useState<Chat | null>(null);
  const [state, dispatch] = useReducer(chatReducer, { status: 'idle' });
  const [input, setInput] = useState('');
  const aiRef = useRef<GoogleGenAI | null>(null);
  const [modelKey, setModelKey] = useState<GeminiModelKey>('2.5-flash');
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>('medium');
  const [thinkingBudget, setThinkingBudget] =
    useState<ThinkingBudgetKey>('medium');

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

  // Load model settings from storage
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

  // Initialize the AI chat session once the key and problem are available
  useEffect(() => {
    if (!apiKey || !problemTitle) {
      setChatSession(null);
      dispatch({ type: 'CLEAR' });
      return;
    }

    debug('Initializing new chat session for problem: %s', problemTitle);
    dispatch({ type: 'INITIALIZE_START' });

    const ai = new GoogleGenAI({ apiKey });
    aiRef.current = ai;

    const modelId = GEMINI_MODELS[modelKey].id;
    const dynamicSystemPrompt = `${SYSTEM_PROMPT}\n\nThe user is currently working on the following problem: "${problemTitle}". Tailor your guidance to this specific problem.`;
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
      },
    });

    setChatSession(newChat);
    dispatch({ type: 'INITIALIZE_SUCCESS' });
  }, [apiKey, problemTitle, modelKey, thinkingLevel, thinkingBudget]);

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
      const messageForModel = attachedCode
        ? [
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
        : messageText;

      const response = await chatSession.sendMessage({
        message: messageForModel,
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

      // One-off generation for hints (no conversation history)
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

  // Derive loading flag from state for backward compatibility
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
    clearCurrentProblemHistory,
  };
}
