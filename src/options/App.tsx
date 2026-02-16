import { GoogleGenAI } from '@google/genai';
import {
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Save,
  Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  GEMINI_MODELS,
  type GeminiModelKey,
  THINKING_BUDGETS,
  THINKING_LEVELS,
  type ThinkingBudgetKey,
  type ThinkingLevel,
} from '@/sidepanel/config';

export default function App() {
  const [apiKey, setApiKey] = useState('');
  const [isKeySaved, setIsKeySaved] = useState(false);
  const [showSavedMessage, setShowSavedMessage] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] =
    useState<GeminiModelKey>('2.5-flash');
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>('medium');
  const [thinkingBudget, setThinkingBudget] =
    useState<ThinkingBudgetKey>('medium');

  useEffect(() => {
    chrome.storage.local.get(
      ['apiKey', 'geminiModel', 'thinkingLevel', 'thinkingBudget'],
      (data) => {
        if (data.apiKey) {
          setApiKey(data.apiKey);
          setIsKeySaved(true);
        }
        if (data.geminiModel) {
          setSelectedModel(data.geminiModel as GeminiModelKey);
        }
        if (data.thinkingLevel) {
          setThinkingLevel(data.thinkingLevel as ThinkingLevel);
        }
        if (data.thinkingBudget) {
          setThinkingBudget(data.thinkingBudget as ThinkingBudgetKey);
        }
      }
    );
  }, []);

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setValidationError('Please enter an API key.');
      return;
    }

    setValidating(true);
    setValidationError(null);

    try {
      // Validate the API key with a simple request
      const ai = new GoogleGenAI({ apiKey });
      await ai.models.generateContent({
        model: GEMINI_MODELS[selectedModel].id,
        contents: 'test',
      });

      // If successful, save the key and settings
      chrome.storage.local.set(
        {
          apiKey,
          geminiModel: selectedModel,
          thinkingLevel,
          thinkingBudget,
        },
        () => {
          setIsKeySaved(true);
          setShowSavedMessage(true);
          setValidating(false);
          setTimeout(() => {
            setShowSavedMessage(false);
          }, 2000);
        }
      );
    } catch {
      setValidating(false);
      setValidationError(
        'Invalid API key or model unavailable. Please check your key and try again.'
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
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !showSavedMessage && !validating) {
                      handleSave();
                    }
                  }}
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

        {/* Model Configuration */}
        <div className="rounded-lg bg-card border border-border p-5 mt-4">
          <div className="mb-4">
            <h2 className="text-sm font-semibold mb-1">Model Settings</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Configure the AI model and behavior.
            </p>
          </div>

          <div className="space-y-4">
            {/* Model Selection */}
            <div>
              <label
                htmlFor="model-select"
                className="text-xs uppercase tracking-widest text-muted-foreground font-medium"
              >
                Model
              </label>
              <select
                id="model-select"
                value={selectedModel}
                onChange={(e) =>
                  setSelectedModel(e.target.value as GeminiModelKey)
                }
                className="mt-1.5 w-full h-9 rounded-md bg-secondary/50 border border-border px-3 text-sm text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25 transition-all"
              >
                {Object.entries(GEMINI_MODELS).map(([key, model]) => (
                  <option key={key} value={key}>
                    {model.name} - {model.description}
                  </option>
                ))}
              </select>
            </div>

            {/* Thinking Configuration */}
            {GEMINI_MODELS[selectedModel].supportsThinking && (
              <div>
                <label
                  htmlFor="thinking-config"
                  className="text-xs uppercase tracking-widest text-muted-foreground font-medium"
                >
                  Thinking Configuration
                </label>
                <select
                  id="thinking-config"
                  value={
                    GEMINI_MODELS[selectedModel].thinkingType === 'level'
                      ? thinkingLevel
                      : thinkingBudget
                  }
                  onChange={(e) => {
                    if (GEMINI_MODELS[selectedModel].thinkingType === 'level') {
                      setThinkingLevel(e.target.value as ThinkingLevel);
                    } else {
                      setThinkingBudget(e.target.value as ThinkingBudgetKey);
                    }
                  }}
                  className="mt-1.5 w-full h-9 rounded-md bg-secondary/50 border border-border px-3 text-sm text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25 transition-all"
                >
                  {GEMINI_MODELS[selectedModel].thinkingType === 'level'
                    ? Object.entries(THINKING_LEVELS).map(([key, config]) => (
                        <option key={key} value={key}>
                          {config.name} - {config.description}
                        </option>
                      ))
                    : Object.entries(THINKING_BUDGETS).map(([key, config]) => (
                        <option key={key} value={key}>
                          {config.name} - {config.description}
                        </option>
                      ))}
                </select>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {GEMINI_MODELS[selectedModel].thinkingType === 'level'
                    ? 'Thinking level controls reasoning depth. Higher levels may be slower.'
                    : 'Thinking budget controls tokens used for reasoning (0-32k).'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
