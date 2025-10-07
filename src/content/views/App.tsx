import { useState } from 'react';
import './App.css';
import { Button } from '@/components/ui/button';
import { MessageSquareCode } from 'lucide-react';

function App() {
  const [show, setShow] = useState(false);

  const handleOpenPanel = () => {
    chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
  };

  return (
    <div className="fixed right-0 bottom-0 m-5 z-[100] flex items-end font-sans select-none leading-none">
      <Button 
        className="toggle-button"
        onClick={handleOpenPanel}
      >
        <MessageSquareCode className="w-6 h-6 text-background"/>
      </Button>
    </div>
  );
}

export default App;
