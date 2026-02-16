import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import { useEffect, useRef, useCallback } from 'react';
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const autoResize = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, []);

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 px-4 pt-3 overflow-hidden">
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
        <div ref={messagesEndRef} />
      </ScrollArea>

      {/* Hints */}
      <div className="flex-shrink-0 px-4 py-2.5 border-t border-border">
        <span className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
          Quick hints
        </span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {hintPrompts.map((hint) => {
            const Icon = hint.icon;
            return (
              <button
                key={hint.id}
                disabled={loading}
                onClick={() => onSend(hint.messageText, hint.displayText)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-secondary-foreground bg-secondary hover:bg-secondary/80 hover:text-foreground border border-border/50 hover:border-border transition-all disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap"
              >
                <Icon className="h-3 w-3" />
                {hint.buttonText}
              </button>
            );
          })}
        </div>
      </div>

      {/* Input */}
      <div className="px-4 py-3 flex items-end gap-2 flex-shrink-0 border-t border-border bg-background">
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          disabled={loading}
          onChange={(e) => {
            onChangeInput(e.target.value);
            autoResize();
          }}
          placeholder="Ask a question..."
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSend(input);
              // Reset height after send
              if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
              }
            }
          }}
          className="flex-1 min-h-[36px] max-h-[120px] rounded-md bg-secondary/50 border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25 transition-all disabled:opacity-50 resize-none leading-tight"
        />
        <Button
          size="icon"
          onClick={() => {
            onSend(input);
            if (textareaRef.current) {
              textareaRef.current.style.height = 'auto';
            }
          }}
          disabled={!input.trim() || loading}
          className="h-9 w-9 shrink-0"
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
