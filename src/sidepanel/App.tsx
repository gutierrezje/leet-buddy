import { Settings } from 'lucide-react';
import { useState } from 'react';
import ApiKeyError from './components/ApiKeyError';
import ChatPane from './components/ChatPane';
import EmptyState from './components/EmptyState';
import ReviewPane from './components/ReviewPane';
import SaveModal from './components/SaveModal';
import Stopwatch from './components/Stopwatch';
import { TabNavigation } from './components/TabNavigation';
import { HINT_PROMPTS } from './config';
import { useApiKeyState } from './hooks/useApiKeyState';
import { useChatSession } from './hooks/useChatSession';
import { useProblemContext } from './hooks/useProblemContext';
import { useSubmissionFlow } from './hooks/useSubmissionFlow';

export default function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'review'>('chat');

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

  if (!apiKey && !apiKeyLoading) {
    return <ApiKeyError onOpenOptions={handleOpenOptions} />;
  }

  if (!currentProblem?.title && !problemLoading) {
    return <EmptyState />;
  }

  if ((problemLoading || chatLoading) && messages.length <= 1) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <div className="h-1 w-1 rounded-full bg-primary animate-bounce [animation-delay:-300ms]" />
          <div className="h-1 w-1 rounded-full bg-primary animate-bounce [animation-delay:-150ms]" />
          <div className="h-1 w-1 rounded-full bg-primary animate-bounce" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen flex flex-col bg-background text-foreground overflow-x-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center justify-center h-8 w-8 rounded-md bg-primary/15 flex-shrink-0">
              <span className="text-primary font-semibold text-sm font-mono">
                LB
              </span>
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold tracking-tight leading-tight">
                LeetBuddy
              </h1>
              <p className="text-xs text-muted-foreground truncate leading-tight mt-0.5">
                {currentProblem?.title || 'No problem detected'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Stopwatch onStop={handleStopwatchStop} resetTrigger={resetTick} />
            <button
              type="button"
              onClick={handleOpenOptions}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
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
