import { Button } from '@/components/ui/button';
import { AlertTriangle, Settings, ExternalLink } from 'lucide-react';

interface ApiKeyErrorProps {
  onOpenOptions: () => void;
}

export default function ApiKeyError({ onOpenOptions }: ApiKeyErrorProps) {
  return (
    <div className="bg-background flex flex-col items-center justify-center h-screen p-6 text-center">
      <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
        <AlertTriangle className="w-8 h-8 text-primary" />
      </div>
      <h2 className="text-lg text-foreground font-semibold">
        API Key Required
      </h2>
      <p className="text-sm text-foreground mb-4 leading-relaxed">
        To start using LeetBuddy, please set up your Google AI Studio API key in
        the extension configurations page.
      </p>
      <div className="mb-6 p-4 bg-muted rounded-lg text-left">
        <p className="text-xs text-muted-foreground mb-2">
          Don't have an API key yet?
        </p>
        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 hover:underline"
        >
          Get your free API key from Google AI Studio
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
      <Button onClick={onOpenOptions}>
        <Settings className="mr-2 h-4 w-4" />
        Open Configuration
      </Button>
    </div>
  );
}
