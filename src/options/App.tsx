import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Save,
  Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { GEMINI_MODEL } from '@/sidepanel/config';

export default function App() {
  const [apiKey, setApiKey] = useState('');
  const [isKeySaved, setIsKeySaved] = useState(false);
  const [showSavedMessage, setShowSavedMessage] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    chrome.storage.local.get('apiKey', (data) => {
      if (data.apiKey) {
        setApiKey(data.apiKey);
        setIsKeySaved(true);
      }
    });
  }, []);

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setValidationError('Please enter an API key.');
      return;
    }

    setValidating(true);
    setValidationError(null);

    try {
      // Validate the API key by making a simple request
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
      await model.generateContent('test');

      // If successful, save the key
      chrome.storage.local.set({ apiKey }, () => {
        setIsKeySaved(true);
        setShowSavedMessage(true);
        setValidating(false);
        setTimeout(() => {
          setShowSavedMessage(false);
        }, 2000);
      });
    } catch {
      setValidating(false);
      setValidationError(
        'Invalid API key. Please check your key and try again.'
      );
    }
  };

  const handleRemove = () => {
    chrome.storage.local.remove('apiKey', () => {
      setApiKey('');
      setIsKeySaved(false);
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-lg mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center h-9 w-9 rounded-md bg-primary/15">
              <span className="text-primary font-semibold text-sm font-mono">
                LB
              </span>
            </div>
            <h1 className="text-lg font-semibold tracking-tight">LeetBuddy</h1>
          </div>
          <p className="text-sm text-muted-foreground">Configuration</p>
        </div>

        {/* API Key Section */}
        <div className="rounded-lg bg-card border border-border p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold mb-1">
              Google AI Studio API Key
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Required to enable AI-powered interview guidance.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label
                htmlFor="api-key"
                className="text-xs uppercase tracking-widest text-muted-foreground font-medium"
              >
                API Key
              </label>
              <div className="mt-1.5 flex gap-2">
                <input
                  id="api-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Paste your API key..."
                  className="flex-1 h-9 rounded-md bg-secondary/50 border border-border px-3 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25 transition-all"
                />
                <Button
                  onClick={handleSave}
                  disabled={showSavedMessage || validating}
                  className="text-xs h-9"
                >
                  {showSavedMessage ? (
                    <>
                      <CheckCircle className="h-3.5 w-3.5" />
                      Saved
                    </>
                  ) : validating ? (
                    <>Validating...</>
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5" />
                      Save
                    </>
                  )}
                </Button>
                {isKeySaved && (
                  <Button
                    variant="ghost"
                    onClick={handleRemove}
                    className="h-9 w-9 text-muted-foreground hover:text-destructive"
                    size="icon"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>

            {validationError && (
              <div className="flex items-center gap-2 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                {validationError}
              </div>
            )}

            <div className="pt-2 border-t border-border">
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
              >
                Get a free API key from Google AI Studio
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
