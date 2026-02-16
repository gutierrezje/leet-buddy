import { PanelRight, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function App() {
  const handleOpenOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  const handleOpenSidePanel = async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (tab) {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    }
  };

  return (
    <div className="w-72 bg-background p-4">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="flex items-center justify-center h-8 w-8 rounded-md bg-primary/15 shrink-0">
          <span className="text-primary font-semibold text-sm font-mono">
            LB
          </span>
        </div>
        <div>
          <h1 className="text-sm font-semibold tracking-tight">LeetBuddy</h1>
          <p className="text-xs text-muted-foreground">
            AI Interview Assistant
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Button
          onClick={handleOpenSidePanel}
          className="w-full justify-start text-xs h-8"
        >
          <PanelRight className="h-3.5 w-3.5" />
          Open Side Panel
        </Button>
        <Button
          onClick={handleOpenOptions}
          variant="outline"
          className="w-full justify-start text-xs h-8"
        >
          <Settings className="h-3.5 w-3.5" />
          Configuration
        </Button>
      </div>
    </div>
  );
}
