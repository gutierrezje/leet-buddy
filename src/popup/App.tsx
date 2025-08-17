import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function App() {
  const handleOpenOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  return (
    <div className="w-80">
      <Card className="border-0 shadow-none">
        <CardHeader className="">
          <div>
            <CardTitle className="text-white">LeetBuddy</CardTitle>
            <CardDescription className="">AI Technical Interview Assistant</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center">
          <Button onClick={handleOpenOptions}>Open Options</Button>
        </CardContent>

      </Card>
    </div>
  )
}
