import { useState } from 'react';
import { MessageSquareCode } from 'lucide-react';

import { TabNavigation } from './components/TabNavigation';
import ChatPane from './components/ChatPane';
import ReviewPane from './components/ReviewPane';
import ApiKeyError from './components/ApiKeyError';
import EmptyState from './components/EmptyState';
import Stopwatch from './components/Stopwatch';
import SaveModal from './components/SaveModal';
import { useApiKeyState } from './hooks/useApiKeyState';
import { useProblemContext } from './hooks/useProblemContext';
import { useChatSession } from './hooks/useChatSession';
import { useSubmissionFlow } from './hooks/useSubmissionFlow';
import { HINT_PROMPTS } from './config';

export default function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'review'>('chat');

  // Extract state management to custom hooks
  const { apiKey, loading: apiKeyLoading } = useApiKeyState();
  const { currentProblem, loading: problemLoading } = useProblemContext();

  const {
    messages,
    loading: chatLoading,
    input,
    setInput,
    handleSendMessage,
  } = useChatSession({
    apiKey,
    problemTitle: currentProblem?.title,
  });

  const {
    saveOpen,
    stoppedSec,
    resetTick,
    prevTime,
    handleStopwatchStop,
    handleCancelSave,
    handleConfirmSave,
  } = useSubmissionFlow({ currentProblem });

  const handleOpenOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  // Handle missing API key FIRST (before loading state check)
  if (!apiKey && !apiKeyLoading) {
    return <ApiKeyError onOpenOptions={handleOpenOptions} />;
  }

  // Show empty state if no problem is detected and not loading
  if (!currentProblem?.title && !problemLoading) {
    return <EmptyState />;
  }

  // Show loading state while initializing
  if ((problemLoading || chatLoading) && messages.length <= 1) {
    return (
      <div className="flex items-center justify-center h-full m-4">
        Loading...
      </div>
    );
  }

  return (
    <div className="w-full h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center p-4 border-b border-border ">
        <div className="flex flex-grow items-center">
          <MessageSquareCode
            className="h-10 w-10 px-2 text-background bg-primary rounded-sm mr-3 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={handleOpenOptions}
          />
          <div className="flex items-start justify-between flex-col">
            <h1 className="text-lg font-semibold">LeetBuddy</h1>
            <span className="text-xs text-muted-foreground">
              {currentProblem?.title || 'No problem detected'}
            </span>
          </div>
        </div>
        <Stopwatch onStop={handleStopwatchStop} resetTrigger={resetTick} />
      </div>

      <TabNavigation activeTab={activeTab} onChangeTab={setActiveTab} />

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'chat' ? (
          <ChatPane
            messages={messages}
            input={input}
            loading={chatLoading}
            hintPrompts={HINT_PROMPTS}
            onChangeInput={setInput}
            onSend={handleSendMessage}
          />
        ) : (
          <ReviewPane />
        )}
      </div>

      {currentProblem && (
        <SaveModal
          open={saveOpen}
          onConfirm={handleConfirmSave}
          onCancel={handleCancelSave}
          problem={currentProblem}
          elapsedSec={stoppedSec}
          previousTime={prevTime}
        />
      )}
    </div>
  );
}
