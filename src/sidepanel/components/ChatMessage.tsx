import { cn } from '@/lib/utils';
import { Message } from '@/shared/types';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.sender === 'user';

  return (
    <div
      className={cn('flex mb-2', isUser ? 'justify-end' : 'justify-start')}
    >
      <div
        className={cn(
          'max-w-[85%] min-w-0 rounded-lg px-3.5 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-secondary/70 text-foreground rounded-bl-sm'
        )}
      >
        {message.isLoading ? (
          <div className="flex items-center gap-1 py-1">
            <div className="h-1 w-1 bg-current rounded-full animate-bounce [animation-delay:-300ms] opacity-60" />
            <div className="h-1 w-1 bg-current rounded-full animate-bounce [animation-delay:-150ms] opacity-60" />
            <div className="h-1 w-1 bg-current rounded-full animate-bounce opacity-60" />
          </div>
        ) : isUser ? (
          <p className="whitespace-pre-wrap break-words">{message.text}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-pre:overflow-x-auto prose-pre:max-w-full prose-code:break-words prose-headings:text-foreground prose-strong:text-foreground prose-code:text-primary/90 prose-code:font-mono prose-pre:bg-background/50 prose-pre:border prose-pre:border-border">
            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
              {message.text}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
