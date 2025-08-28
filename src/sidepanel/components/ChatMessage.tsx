import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Message } from '../types';

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.sender === 'user';

  return (
    <div className={cn('flex gap-3 m-2', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cn(
        'max-w-xs md:max-w-sm',
        isUser ? 'order-first' : ''
      )}>
        <Card
          className={cn(
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-accent text-accent-foreground'
          )}
        >
          <CardContent className="p-4">
            <p className="whitespace-pre-wrap">{message.text}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
