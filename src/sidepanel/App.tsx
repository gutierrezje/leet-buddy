import { useState, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import { Message } from './types';

import initialMessages from './data/messages.json'; // Assuming you have some example messages
import ChatMessage from './components/ChatMessage';

import { GoogleGenerativeAI, ChatSession } from '@google/generative-ai';
import ApiKeyError from './components/ApiKeyError';

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


`;

export default function App() {
  const [problemTitle, setProblemTitle] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [chatSession, setChatSession] = useState<ChatSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');

  // Set the initial messages
  useEffect(() => {
    setMessages(initialMessages as Message[]);
  }, []);

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
    if (!apiKey || !problemTitle || problemTitle === '') return;

    console.log(`Initializing new chat session for problem: ${problemTitle}`);

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const dynamicSystemPrompt = `${systemPrompt}\n\nThe user is currently working on the following problem: "${problemTitle}". Tailor your guidance to this specific problem.`;

    const chatSession = model.startChat({
      systemInstruction: {
        role: 'user',
        parts: [{ text: dynamicSystemPrompt }],
      },
    });

    setChatSession(chatSession);
    setMessages(initialMessages as Message[]);
    setLoading(false);
  }, [apiKey, problemTitle]);

  // Gets the current problem title from the content script
  useEffect(() => {
    // Find the current tab
    const fetchTitle = () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        if (activeTab && activeTab.id) {
          // Send a message to the content script in the active tab
          chrome.tabs.sendMessage(
            activeTab.id,
            { type: 'GET_PROBLEM_TITLE' },
            (response) => {
              // Handle potential errors before setting state
              if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError.message);
                setProblemTitle('Error fetching problem title');
                return;
              }
              if (response && response.title) {
                setProblemTitle(response.title);
              } else {
                setProblemTitle('Error fetching problem title');
              }
            }
          );
        }
      });
    };

    fetchTitle();

    // add a listener for when the active tab is updated
    const handleTabUpdate = (
      _: number, 
      changeInfo: chrome.tabs.OnUpdatedInfo, 
      tab: chrome.tabs.Tab
    ) => {
      if (
        changeInfo.status === 'complete' &&
        changeInfo.url &&
        tab.active
      ) {
        console.log('Tab URL changed, fetching new problem title...');
        fetchTitle();
        setMessages(initialMessages as Message[]);
      }
    };

    chrome.tabs.onUpdated.addListener(handleTabUpdate);
    
    return () => {
      chrome.tabs.onUpdated.removeListener(handleTabUpdate);
    };
  }, []);

  const handleSendMessage = async (messageText: string) => {
    // prevent sending empty messages
    if (!messageText.trim() || loading || !chatSession) return;

    setLoading(true);
    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: messageText,
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
    return <div>Loading...</div>;
  }

  const handleOpenOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  if (!apiKey || apiKey === '') {
    return <ApiKeyError onOpenOptions={handleOpenOptions} />;
  }

  return (
    <div className="w-full h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <div className="p-4 border-b border-border flex-shrink-0">
        <div className="flex items-start justify-between flex-col">
          <h1 className="text-lg font-semibold">LeetBuddy</h1>
          <span className="text-sm text-muted-foreground">
            Current problem: {problemTitle}
          </span>
        </div>
      </div>

      {/* Message List */}
      <ScrollArea className="flex flex-1 p-4 overflow-hidden">
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 flex gap-2 border-border flex-shrink-0">
        <Input
          value={input}
          disabled={loading}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage(input);
            }
          }}
          className="text-foreground placeholder:text-muted-foreground"
        />

        <Button
          size="icon"
          onClick={() => handleSendMessage(input)}
          disabled={!input.trim() || loading}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
