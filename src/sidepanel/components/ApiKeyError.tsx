import { ExternalLink, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ApiKeyErrorProps {
  onOpenOptions: () => void;
}

export default function ApiKeyError({ onOpenOptions }: ApiKeyErrorProps) {
  return (
    <div className="bg-background flex flex-col items-center justify-center h-screen p-8 text-center">
      <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-destructive/10 mb-4">
        <span className="text-destructive font-mono text-lg font-semibold">
          !
        </span>
      </div>

      <h2 className="text-base font-semibold mb-1">API Key Required</h2>
      <p className="text-xs text-muted-foreground max-w-[260px] leading-relaxed mb-5">
        Set up your Google AI Studio API key to start using LeetBuddy.
      </p>

      <div className="rounded-md bg-secondary/40 border border-border p-3 mb-5 text-left max-w-[260px] w-full">
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-1.5">
          Get a free key
        </p>
        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
        >
          Google AI Studio
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <Button onClick={onOpenOptions} className="text-xs">
        <Settings className="h-3.5 w-3.5" />
        Open Configuration
      </Button>
    </div>
  );
}
