import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useState, useEffect } from 'react';
import { Save, CheckCircle, Trash2 } from 'lucide-react';

export default function App() {
  const [apiKey, setApiKey] = useState('');
  const [isKeySaved, setIsKeySaved] = useState(false);
  const [showSavedMessage, setShowSavedMessage] = useState(false);

  // On component mount, check if an API key is already saved
  useEffect(() => {
    chrome.storage.local.get('apiKey', (data) => {
      if (data.apiKey) {
        setApiKey(data.apiKey);
        setIsKeySaved(true);
      }
    });
  }, []);

  const handleSave = () => {
    // Check if api key is empty
    if (!apiKey.trim()) {
      alert('Please enter a valid API key.');
      return;
    }

    // Save the API key to Chrome storage
    chrome.storage.local.set({ apiKey }, () => {
      setIsKeySaved(true);
      setShowSavedMessage(true);
      setTimeout(() => {
        setShowSavedMessage(false);
      }, 2000);
    });
  };

  const handleRemove = () => {
    chrome.storage.local.remove('apiKey', () => {
      setApiKey('');
      setIsKeySaved(false);
    });
  };

  return (
    <div className="min-h-screen p-4 bg-background text-foreground">
      <div className="text-center mb-4">
        <h1 className="text-2xl font-bold">LeetBuddy Configuration</h1>
      </div>
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Google AI Studio API Key
          </CardTitle>
          <CardDescription className="">
            Enter your Gemini API key below to enable LeetBuddy.
          </CardDescription>
        </CardHeader>
        <CardContent className="">
          <label htmlFor="api-key" className="block mb-2 text-sm font-medium">
            API Key
          </label>
          <div className="mb-4 flex flex-row gap-2">
            <Input
              id="api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Type in your API key here..."
            />
            <Button onClick={handleSave} disabled={showSavedMessage}>
              {showSavedMessage ? (
                <>
                  <CheckCircle className="" />
                  Saved
                </>
              ) : (
                <>
                  <Save className="" />
                  Save
                </>
              )}
            </Button>
            {isKeySaved && (
              <Button variant="destructive" onClick={handleRemove}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
