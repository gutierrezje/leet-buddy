import { type ChatSession, GoogleGenerativeAI } from '@google/generative-ai';
import { useEffect, useReducer, useRef, useState } from 'react';
import type { Message } from '@/shared/types';
import { createLogger } from '@/shared/utils/debug';
import { GEMINI_MODEL, HINT_SYSTEM_PROMPT, SYSTEM_PROMPT } from '../config';
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

export function useChatSession({ apiKey, problemTitle }: UseChatSessionProps) {
  const [messages, setMessages] = useState<Message[]>(
    initialMessages as Message[]
  );
  const [chatSession, setChatSession] = useState<ChatSession | null>(null);
  const [state, dispatch] = useReducer(chatReducer, { status: 'idle' });
  const [input, setInput] = useState('');
  const genAIRef = useRef<GoogleGenerativeAI | null>(null);

  // Initialize the AI chat session once the key and problem are available
  useEffect(() => {
    if (!apiKey || !problemTitle) {
      // Reset chat state when problem is cleared or API key is removed
      setChatSession(null);
      setMessages(initialMessages as Message[]);
      dispatch({ type: 'CLEAR' });
      return;
    }

    debug('Initializing new chat session for problem: %s', problemTitle);
    dispatch({ type: 'INITIALIZE_START' });

    const genAI = new GoogleGenerativeAI(apiKey);
    genAIRef.current = genAI;
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    const dynamicSystemPrompt = `${SYSTEM_PROMPT}\n\nThe user is currently working on the following problem: "${problemTitle}". Tailor your guidance to this specific problem.`;

    const newChatSession = model.startChat({
      systemInstruction: {
        role: 'user',
        parts: [{ text: dynamicSystemPrompt }],
      },
    });

    setChatSession(newChatSession);
    setMessages(initialMessages as Message[]);
    dispatch({ type: 'INITIALIZE_SUCCESS' });
  }, [apiKey, problemTitle]);

  const handleSendMessage = async (
    messageText: string,
    displayText?: string
  ) => {
    // use the display text if provided
    const userDisplayMessage = displayText || messageText;

    // prevent sending empty messages or sending while in wrong state
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

    // update the ui with the user's message and the ai's placeholder message
    setMessages((prevMessages) => [
      ...prevMessages,
      userMessage,
      aiPlaceholder,
    ]);
    setInput('');

    try {
      const result = await chatSession.sendMessage(messageText);
      const response = result.response;
      const aiText = response.text();

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

  const handleSendHint = async (
    hintQuestion: string,
    displayText: string
  ) => {
    // Prevent sending hints while in wrong state or without required context
    if (state.status !== 'ready' || !genAIRef.current || !problemTitle) {
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

    // Add hint messages to UI
    setMessages((prevMessages) => [
      ...prevMessages,
      userMessage,
      aiPlaceholder,
    ]);

    try {
      // Create a one-off chat session just for this hint
      const model = genAIRef.current.getGenerativeModel({ model: GEMINI_MODEL });
      const hintSystemPrompt = `${HINT_SYSTEM_PROMPT}\n\nThe user is working on: "${problemTitle}"`;

      const hintSession = model.startChat({
        systemInstruction: {
          role: 'user',
          parts: [{ text: hintSystemPrompt }],
        },
      });

      const result = await hintSession.sendMessage(hintQuestion);
      const response = result.response;
      const aiText = response.text();

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
