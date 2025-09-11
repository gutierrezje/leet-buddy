import { Button } from '@/components/ui/button';
import { AlertTriangle, Settings } from 'lucide-react';

interface ApiKeyErrorProps {
  onOpenOptions: () => void;
}

export default function ApiKeyError({onOpenOptions}: ApiKeyErrorProps) {
  return (
    <div className="bg-background flex flex-col items-center justify-center h-screen p-6 text-center">
        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-orange-500" />
        </div>
      <h2 className="text-lg text-foreground font-semibold">API Key Required</h2>
      <p className="text-sm text-foreground mb-4 leading-relaxed">
        To start using LeetBuddy, please set up your Google AI Studio API key in the extension configurations page.
      </p>
      <Button onClick={onOpenOptions}>
        <Settings className="mr-2 h-4 w-4" />
        Open Configuration
      </Button>
    </div>
  );
}
