import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import { useEffect, useRef } from 'react';
import ChatMessage from './ChatMessage';
import { Message, HintPrompt } from '@/shared/types';

type Props = {
  messages: Message[];
  input: string;
  loading: boolean;
  hintPrompts: HintPrompt[];
  onChangeInput: (v: string) => void;
  onSend: (text: string, displayText?: string) => void;
};

export default function ChatPane({
  messages,
  input,
  loading,
  hintPrompts,
  onChangeInput,
  onSend,
}: Props) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-4 py-0 mt-2 overflow-hidden">
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
        <div ref={messagesEndRef} />
      </ScrollArea>

      <div className="flex-shrink-0 px-4 py-2 border-t border-border">
        <h2 className="text-lg font-semibold">Hints:</h2>
        <div className="mt-2 grid grid-cols-2 gap-4">
          {hintPrompts.map((hint) => {
            const Icon = hint.icon;
            return (
              <Button
                key={hint.id}
                variant="outline"
                disabled={loading}
                onClick={() => onSend(hint.messageText, hint.displayText)}
              >
                <Icon className="h-4 w-4 text-muted-foreground" />
                {hint.buttonText}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="p-4 pt-2 flex gap-2 border-border flex-shrink-0">
        <Input
          value={input}
          disabled={loading}
          onChange={(e) => onChangeInput(e.target.value)}
          placeholder="Type your message..."
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSend(input);
            }
          }}
          className="text-foreground placeholder:text-muted-foreground"
        />
        <Button
          size="icon"
          onClick={() => onSend(input)}
          disabled={!input.trim() || loading}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
