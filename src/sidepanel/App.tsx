import { useState, useEffect } from 'react';


export default function App() {
  const [problemTitle, setProblemTitle] = useState('Loading problem title...');

  useEffect(() => {
    // Find the current tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (activeTab && activeTab.id) {
        // Send a message to the content script in the active tab
        chrome.tabs.sendMessage(
          activeTab.id, 
          { type: 'GET_PROBLEM_TITLE' },
          (response) => {
            // Handle potential errors before setting state
            if (chrome.runtime.lastError) {
              console.error(chrome.runtime.lastError.message);
              setProblemTitle('Error fetching problem title');
              return;
            }
            if (response && response.title) {
              setProblemTitle(response.title);
            } else {
              setProblemTitle('Error fetching problem title');
            }
          }
        );
      }
    });
  }, []);

  return (
    <div>
      <h1 className="text-lg font-bold">{problemTitle}</h1>

    </div>
  )
}
