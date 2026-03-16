import './App.css';
import { MessageSquareCode } from 'lucide-react';
import { Button } from '@/components/ui/button';

function SidebarLauncher() {
  const handleOpenPanel = () => {
    chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
  };

  return (
    <div className="fixed right-0 bottom-0 m-5 z-[100] flex items-end font-sans select-none leading-none">
      <Button
        className="crx-launcher-btn w-12 h-12 rounded-full shadow-md hover:shadow-lg hover:brightness-95 transition-all"
        size="icon"
        onClick={handleOpenPanel}
        style={{ backgroundColor: 'oklch(0.75 0.16 55)', color: '#111' }}
      >
        <MessageSquareCode className="w-6 h-6" />
      </Button>
    </div>
  );
}

export default SidebarLauncher;
