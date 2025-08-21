import { useState, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Send } from 'lucide-react';
import { Message } from './types';


export default function App() {
  const [problemTitle, setProblemTitle] = useState('Loading problem title...');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');

  useEffect(() => {
    // Find the current tab
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
  }, []);

  const handleSendMessage = (messageText: string) => {

  }

  return (
    <div className="w-full h-screen flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-start justify-between flex-col">
          <h1 className="text-lg font-semibold text-gray-800">LeetBuddy</h1>
          <span className="text-sm text-gray-500">Current problem: {problemTitle}</span>
        </div>
      </div>

      {/* Message List */}
      <ScrollArea className="flex-1 p-4">

      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage(input);
            }
          
          }}
        />

        <Button
          size="icon"
          onClick={() => handleSendMessage(input)}
          disabled={!input.trim()}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      
    </div>
  )
}
