import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function App() {
  const handleOpenOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  const handleOpenSidePanel = async () => {
    // Get the current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab) {
      // Open the side panel for the current tab
      await chrome.sidePanel.open({ windowId: tab.windowId });
    }
  };

  return (
    <div className="w-80 rounded-lg overflow-hidden bg-background">
      <Card className="border-0 shadow-none">
        <CardHeader className="">
          <div>
            <CardTitle className="text-white">LeetBuddy</CardTitle>
            <CardDescription className="">AI Technical Interview Assistant</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <Button onClick={handleOpenSidePanel}>Open chat</Button>
          <Button onClick={handleOpenOptions}>Open Options</Button>
        </CardContent>

      </Card>
    </div>
  )
}
