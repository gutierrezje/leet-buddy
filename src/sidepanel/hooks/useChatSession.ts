import { type Chat, GoogleGenAI } from '@google/genai';
import { useEffect, useReducer, useRef, useState } from 'react';
import type { Message } from '@/shared/types';
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

export function useChatSession({ apiKey, problemTitle }: UseChatSessionProps) {
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
      setMessages(initialMessages as Message[]);
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
    setMessages(initialMessages as Message[]);
    dispatch({ type: 'INITIALIZE_SUCCESS' });
  }, [apiKey, problemTitle, modelKey, thinkingLevel, thinkingBudget]);

  const handleSendMessage = async (
    messageText: string,
    displayText?: string
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
      const response = await chatSession.sendMessage({
        message: messageText,
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

  return {
    messages,
    loading,
    input,
    setInput,
    handleSendMessage,
    handleSendHint,
  };
}
