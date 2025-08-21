import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { Save, CheckCircle } from 'lucide-react';

export default function App() {
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    // Check if api key is empty
    if (!apiKey.trim()) {
      alert('Please enter a valid API key.');
      return;
    }

    // Save the API key to Chrome storage
    chrome.storage.local.set({ apiKey }, () => {
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
      }, 2000);
    });
  };

  return (
    <div className="min-h-screen p-4">
      <div className="text-center mb-4">
        <h1 className="text-2xl font-bold">LeetBuddy Configuration</h1>
      </div>
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Google AI Studio API Key
          </CardTitle>
          <CardDescription className="">
            Enter your Gemini API key to enable below.
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
            <Button onClick={handleSave} disabled={saved}>
              {saved ? (
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
