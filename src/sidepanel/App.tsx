import { useState, useEffect, useRef } from 'react';
import {
  Blocks,
  LayoutTemplate,
  Gauge,
  Lightbulb,
  MessageSquareCode,
} from 'lucide-react';
import { GoogleGenerativeAI, ChatSession } from '@google/generative-ai';

import initialMessages from './data/messages.json';
import {
  Message,
  HintPrompt,
  CurrentProblem,
} from '@/shared/types';
import { TabNavigation } from './components/TabNavigation';
import ChatPane from './components/ChatPane';
import ReviewPane from './components/ReviewPane';
import ApiKeyError from './components/ApiKeyError';
import Stopwatch from './components/Stopwatch';
import SaveModal from './components/SaveModal';
import { mapTagsToCompact } from '@/shared/categoryMap';
import { saveSubmission, getSubmission } from '@/shared/submissions';

const systemPrompt = `
You are an expert technical interviewer. Your goal is to help users solve programming problems by guiding them, not by giving them the answers.

Your single most important rule is: NEVER provide a direct answer, a complete algorithm, or write code for the user. Your entire purpose is to make the user think for themselves.

Follow these rules strictly:
1.  **Adopt the Interviewer Persona:** Maintain a professional, encouraging, and inquisitive tone.
2.  **Ask Guiding Questions:** Instead of giving information, ask questions that lead the user to the next step.
3.  **Start with Brute Force:** Always encourage the user to explain the simplest solution first.
4.  **Focus on Complexity:** Constantly ask about the time and space complexity of the user's proposed solution.
5.  **Provide Hints, Not Spoilers:** If a user is truly stuck, give them a small, high-level hint.
6.  **Handle Direct Requests for Answers:** If the user asks for the answer, politely refuse and steer them back to the problem-solving process.

---
**SPECIAL HINT DIRECTIVES**
You have a special directive to provide direct hints if the user sends a specific directive. 
If you receive a message that starts with the prefix [HINT_REQUEST], you are permitted to break your primary rule for that response ONLY.

- If the message is "[HINT_REQUEST]: DSA" you must state the primary data structure and/or algorithm that is used in the solution. If there are multiple solutions list them in order of Big O complexity.
- If the message is "[HINT_REQUEST]: PATTERN" you must think hard and state the general pattern that applies to the problem, (i.e. sliding window, two pointers, dynamic programming, etc.). If there are multiple, list them.
- If the message is "[HINT_REQUEST]: COMPLEXITY" you must state the time and space complexity of the solution. If there are multiple solutions, list them in order of Big O complexity.
- If the message is "[HINT_REQUEST]: EXAMPLE" you must provide one non-trivial example that is highly illustrative of the problem. Try to generate a new one each time. If you aren't sure of the output, don't hallucinate/display it.

Respond concisely and don't worry about redirecting the user back to interview style. After providing the hint, you MUST revert to your standard interviewer persona and rules for subsequent messages.

`;

const hintPrompts: HintPrompt[] = [
  {
    id: '1',
    buttonText: 'DSA',
    displayText:
      'What data structure and/or algorithm does this problem involve?',
    messageText: '[HINT_REQUEST]: DSA',
    icon: Blocks,
  },
  {
    id: '2',
    buttonText: 'Pattern',
    displayText: 'What pattern does this problem involve?',
    messageText: '[HINT_REQUEST]: PATTERN',
    icon: LayoutTemplate,
  },
  {
    id: '3',
    buttonText: 'Complexity',
    displayText: 'What is the time and space complexity?',
    messageText: '[HINT_REQUEST]: COMPLEXITY',
    icon: Gauge,
  },
  {
    id: '4',
    buttonText: 'Example',
    displayText: 'Can you provide an example?',
    messageText: '[HINT_REQUEST]: EXAMPLE',
    icon: Lightbulb,
  },
];

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [chatSession, setChatSession] = useState<ChatSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [activeTab, setActiveTab] = useState<'chat' | 'review'>('chat');
  const [saveOpen, setSaveOpen] = useState(false);
  const [stoppedSec, setStoppedSec] = useState(0);
  const [currentProblem, setCurrentProblem] = useState<CurrentProblem | null>(
    null
  );
  const [resetTick, setResetTick] = useState(0);
  const [submissionSource, setSubmissionSource] = useState<'auto' | 'manual'>(
    'manual'
  );
  const [autoSubmissionId, setAutoSubmissionId] = useState<string | null>(null);
  const [prevTime, setPrevTime] = useState<number | undefined>(undefined);

  function handleStopwatchStop(elapsed: number) {
    setStoppedSec(elapsed);
    setSubmissionSource('manual');
    setPrevTime(undefined);
    setSaveOpen(true);

    if (currentProblem?.slug) {
      getSubmission(currentProblem.slug).then((rec) => {
        setPrevTime(rec?.elapsedSec);
      });
    }
  }

  function handleCancelSave() {
    setSaveOpen(false);
  }

  function handleConfirmSave(finalElapsedSec: number) {
    setSaveOpen(false);
    setResetTick((t) => t + 1);

    const now = Date.now();

    const submissionId =
      submissionSource === 'auto'
        ? autoSubmissionId || `auto-${now}`
        : `manual-${now}`;

    saveSubmission(currentProblem!.slug, {
      submissionId,
      source: submissionSource,
      elapsedSec: finalElapsedSec,
      problem: currentProblem!,
      at: now,
    });
  }

  // Gets the API key from storage
  useEffect(() => {
    chrome.storage.local.get('apiKey', (data) => {
      if (data.apiKey) {
        setApiKey(data.apiKey);
      } else {
        console.error('API key not found');
        setLoading(false);
      }
    });
  }, []);

  // Initialize the AI chat session once the key is available
  useEffect(() => {
    if (!apiKey || !currentProblem?.title) return;
    const title = currentProblem.title;
    console.log(`Initializing new chat session for problem: ${title}`);

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const dynamicSystemPrompt = `${systemPrompt}\n\nThe user is currently working on the following problem: "${title}". Tailor your guidance to this specific problem.`;

    const chatSession = model.startChat({
      systemInstruction: {
        role: 'user',
        parts: [{ text: dynamicSystemPrompt }],
      },
    });

    setChatSession(chatSession);
    setMessages(initialMessages as Message[]);
    setLoading(false);
  }, [apiKey, currentProblem?.title]);

  const lastSlugRef = useRef<string | null>(null);

  // Bootstrap from storage on mount
  useEffect(() => {
    chrome.storage.local.get(['currentProblem'], (data) => {
      const cp = data.currentProblem;
      if (cp?.slug && cp?.title) {
        const compact = mapTagsToCompact(cp.tags || []);
        if (lastSlugRef.current !== cp.slug) {
          console.log(`Bootstrapped problem slug from storage: ${cp.slug}`);
          setCurrentProblem({
            slug: cp.slug,
            title: cp.title,
            difficulty: cp.difficulty || '',
            tags: compact,
          });
          lastSlugRef.current = cp.slug;
          setLoading(true);
        }
      } else {
        setLoading(true);
      }
    });
  }, []);

  // Subscribe to messages from content script (when panel is already open)
  useEffect(() => {
    function handleMessage(msg: {
      type?: string;
      title?: string;
      slug?: string;
      difficulty?: string;
      tags?: string[];
      submissionId?: string;
      at?: number;
    }) {
      // Handle problem metadata updates
      if (msg.type === 'PROBLEM_METADATA' && msg.slug) {
        const compact = mapTagsToCompact(msg.tags || []);
        console.log(`[LeetBuddy]: compact categories: ${compact}`);
        if (lastSlugRef.current !== msg.slug) {
          lastSlugRef.current = msg.slug;
          setMessages(initialMessages as Message[]);
          setChatSession(null); // triggers re-init
          setCurrentProblem({
            slug: msg.slug,
            title: msg.title || '',
            difficulty: msg.difficulty || 'Unknown',
            tags: compact,
          });
        } else {
          // if same slug, update in case stale
          setCurrentProblem((prev) => {
            if (prev) {
              return {
                ...prev,
                title: msg.title || prev.title,
                difficulty: msg.difficulty || prev.difficulty,
                tags: compact.length > 0 ? compact : prev.tags,
              };
            } else {
              return prev;
            }
          });
        }
      }

      // Handle accepted submissions
      if (msg.type === 'SUBMISSION_ACCEPTED' && msg.slug) {
        console.log(
          `[LeetBuddy] Auto-detected accepted submission for ${msg.slug}`
        );

        chrome.storage.local.get(['currentProblem'], async (data) => {
          const problem = data.currentProblem as CurrentProblem | null;
          if (!problem || problem.slug != msg.slug) {
            console.warn(
              '[LeetBuddy] Warning: Current problem mismatch with the submission slug.'
            );
            return;
          }

          const existing = await getSubmission(problem.slug);
          if (existing?.submissionId === msg.submissionId) {
            return; // already recorded
          }

          const endAt = msg.at || Date.now();
          const elapsedSec = problem.startAt
            ? Math.floor((endAt - problem.startAt) / 1000)
            : 0;

          setStoppedSec(elapsedSec);
          setSubmissionSource('auto');
          setAutoSubmissionId(msg.submissionId || `auto-${endAt}`);
          setPrevTime(existing?.elapsedSec);
          setSaveOpen(true);
        });
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage);

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  const handleSendMessage = async (
    messageText: string,
    displayText?: string
  ) => {
    // use the display text if provided
    const userDisplayMessage = displayText || messageText;

    // prevent sending empty messages
    if (!messageText.trim() || loading || !chatSession) return;

    setLoading(true);
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
    } catch (error) {
      console.error('Error sending message to AI:', error);
      const errorMessage: Message = {
        ...aiPlaceholder,
        text: 'Sorry, I encountered an error. Please check your API key or network connection and try again.',
        isLoading: false,
      };

      setMessages((prev) =>
        prev.map((msg) => (msg.id === aiPlaceholder.id ? errorMessage : msg))
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading && messages.length <= 1) {
    return (
      <div className="flex items-center justify-center h-full m-4">
        Loading...
      </div>
    );
  }

  // Handle missing API key
  const handleOpenOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  if (!apiKey || apiKey === '') {
    return <ApiKeyError onOpenOptions={handleOpenOptions} />;
  }

  return (
    <div className="w-full h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center p-4 border-b border-border ">
        <div className="flex flex-grow items-center">
          <MessageSquareCode 
            className="h-10 w-10 px-2 text-background bg-primary rounded-sm mr-3 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity" 
            onClick={handleOpenOptions}
          />
          <div className="flex items-start justify-between flex-col">
            <h1 className="text-lg font-semibold">LeetBuddy</h1>
            <span className="text-xs text-muted-foreground">
              {currentProblem?.title || 'No problem detected'}
            </span>
          </div>
        </div>
        <Stopwatch onStop={handleStopwatchStop} resetTrigger={resetTick} />
      </div>

      <TabNavigation activeTab={activeTab} onChangeTab={setActiveTab} />

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'chat' ? (
          <ChatPane
            messages={messages}
            input={input}
            loading={loading}
            hintPrompts={hintPrompts}
            onChangeInput={setInput}
            onSend={handleSendMessage}
          />
        ) : (
          <ReviewPane />
        )}
      </div>

      <SaveModal
        open={saveOpen}
        onConfirm={handleConfirmSave}
        onCancel={handleCancelSave}
        problem={currentProblem!}
        elapsedSec={stoppedSec}
        previousTime={prevTime}
      />
    </div>
  );
}
