import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Message } from '../types';
import ReactMarkdown from 'react-markdown';

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.sender === 'user';

  return (
    <div
      className={cn('flex mb-2', isUser ? 'justify-end' : 'justify-start')}
    >
      <div className={cn('max-w-xs md:max-w-sm', isUser ? 'order-first' : '')}>
        <Card
          className={cn(
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-accent text-accent-foreground'
          )}
        >
          <CardContent className="px-4 text-sm leading-relaxed">
            {message.isLoading ? (
              <div className="flex items-center justify-center space-x-1">
                <div className="h-1 w-1 bg-current rounded-full animate-bounce [animation-delay:-300ms]" />
                <div className="h-1 w-1 bg-current rounded-full animate-bounce [animation-delay:-150ms]" />
                <div className="h-1 w-1 bg-current rounded-full animate-bounce" />
              </div>
            ) : 
            isUser ? (
              <p className="whitespace-pre-wrap">{message.text}</p>
            ) : (
              <div className="prose prose-sm dark:prose-invert prose-p:my-0 prose-ul:my-0 prose-li:my-0">
                <ReactMarkdown>{message.text}</ReactMarkdown>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
