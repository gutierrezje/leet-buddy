import { Settings } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CurrentCodeSnapshot } from '@/shared/types';
import ApiKeyError from './components/ApiKeyError';
import ChatPane from './components/ChatPane';
import CodeCaptureDebugWidget from './components/CodeCaptureDebugWidget';
import EmptyState from './components/EmptyState';
import InterviewProgressCard from './components/InterviewProgressCard';
import ReviewPane from './components/ReviewPane';
import SaveModal from './components/SaveModal';
import Stopwatch from './components/Stopwatch';
import { TabNavigation } from './components/TabNavigation';
import { HINT_PROMPTS } from './config';
import { useApiKeyState } from './hooks/useApiKeyState';
import { useChatSession } from './hooks/useChatSession';
import { useInterviewSession } from './hooks/useInterviewSession';
import { useProblemContext } from './hooks/useProblemContext';
import { useSubmissionFlow } from './hooks/useSubmissionFlow';

export default function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'interview' | 'review'>(
    'chat'
  );
  const [attachCodeNext, setAttachCodeNext] = useState(false);
  const [attachCodeBusy, setAttachCodeBusy] = useState(false);
  const [attachedSnapshot, setAttachedSnapshot] =
    useState<CurrentCodeSnapshot | null>(null);
  const stopwatchSecondsRef = useRef(0);

  const { apiKey, loading: apiKeyLoading } = useApiKeyState();
  const {
    currentProblem,
    currentCodeSnapshot,
    loading: problemLoading,
  } = useProblemContext();

  const {
    session: interviewSession,
    stageChecklist,
    updateChecklist,
    applyStateUpdate,
    markCodingDetected,
    setBaselineNonCommentFingerprint,
    hasCandidateCodeChangedFromBaseline,
    advanceStage,
    completeWithoutScore,
    resetSession,
  } = useInterviewSession(currentProblem?.slug);

  const stageLabelMap = {
    before_coding: 'Before Coding',
    during_coding: 'During Coding',
    after_coding: 'After Coding',
    completed: 'Completed',
  } as const;

  const interviewStageLabel = interviewSession
    ? stageLabelMap[interviewSession.stage]
    : 'Before Coding';
  const interviewMissingItems = useMemo(
    () =>
      stageChecklist
        .filter((item) => item.status !== 'done')
        .map((item) => item.label),
    [stageChecklist]
  );

  const looksLikeRealCode = useCallback(
    (snapshot: CurrentCodeSnapshot): boolean => {
      return snapshot.hasNonCommentCode === true;
    },
    []
  );

  useEffect(() => {
    if (!interviewSession || !currentProblem || !currentCodeSnapshot) return;
    if (currentCodeSnapshot.slug !== currentProblem.slug) return;

    if (
      interviewSession.stage === 'before_coding' &&
      !interviewSession.baselineNonCommentFingerprint
    ) {
      setBaselineNonCommentFingerprint(
        currentCodeSnapshot.nonCommentFingerprint
      );
      return;
    }

    if (interviewSession.stage !== 'before_coding') return;
    if (!looksLikeRealCode(currentCodeSnapshot)) return;
    if (
      !hasCandidateCodeChangedFromBaseline(
        currentCodeSnapshot.nonCommentFingerprint
      )
    ) {
      return;
    }

    markCodingDetected();
  }, [
    currentCodeSnapshot,
    currentProblem,
    interviewSession,
    looksLikeRealCode,
    setBaselineNonCommentFingerprint,
    hasCandidateCodeChangedFromBaseline,
    markCodingDetected,
  ]);

  const {
    messages,
    loading: chatLoading,
    isReady: chatReady,
    input,
    setInput,
    handleSendMessage,
    handleSendHint,
    handleInterviewEvent,
    clearCurrentProblemHistory,
  } = useChatSession({
    apiKey,
    problemSlug: currentProblem?.slug,
    problemTitle: currentProblem?.title,
    interviewStage: interviewSession?.stage,
    interviewStageLabel,
    interviewMissingItems,
    interviewChecklist: interviewSession?.checklist,
    onInterviewStateUpdate: applyStateUpdate,
  });

  const initialElapsed = currentProblem?.startAt
    ? Math.max(0, Math.floor((Date.now() - currentProblem.startAt) / 1000))
    : 0;

  const {
    saveOpen,
    stoppedSec,
    resetTick,
    resumeTick,
    prevTime,
    handleStopwatchStop,
    handleCancelSave,
    handleConfirmSave,
  } = useSubmissionFlow({
    currentProblem,
    getStopwatchElapsed: () => stopwatchSecondsRef.current || initialElapsed,
  });

  const handleOpenOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  const handleToggleCodeAttach = () => {
    if (attachCodeNext) {
      setAttachCodeNext(false);
      return;
    }

    if (!currentProblem?.slug) return;

    setAttachCodeBusy(true);
    const nonce = Date.now();
    chrome.storage.local.set(
      {
        codeSnapshotRequestNonce: nonce,
      },
      () => {
        if (chrome.runtime.lastError) {
          setAttachCodeBusy(false);
          return;
        }

        window.setTimeout(() => {
          chrome.storage.local.get(['currentCodeSnapshot'], (data) => {
            const snapshot = data.currentCodeSnapshot as
              | CurrentCodeSnapshot
              | undefined;
            if (snapshot?.slug === currentProblem.slug && snapshot.code) {
              setAttachedSnapshot(snapshot);
              setAttachCodeNext(true);
            }
            setAttachCodeBusy(false);
          });
        }, 450);
      }
    );
  };

  const handleSend = (text: string, displayText?: string) => {
    const payload =
      attachCodeNext && attachedSnapshot
        ? {
            codeSnapshot: attachedSnapshot,
          }
        : undefined;

    handleSendMessage(text, displayText, payload);
    if (attachCodeNext) {
      setAttachCodeNext(false);
    }
  };

  const handleAdvanceStageFromUi = () => {
    if (!chatReady) return;
    const from = interviewSession?.stage;
    const prevLabel = interviewStageLabel;
    const nextLabel =
      from === 'before_coding'
        ? 'During Coding'
        : from === 'during_coding'
          ? 'After Coding'
          : 'Completed';

    advanceStage();
    handleInterviewEvent('stage_advance', {
      previousStageLabel: prevLabel,
      nextStageLabel: nextLabel,
    });
  };

  const handleFinishAndRateFromUi = () => {
    if (!chatReady) return;
    completeWithoutScore();
    handleInterviewEvent('finish_and_rate', {
      previousStageLabel: 'After Coding',
    });
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
            <Stopwatch
              key={currentProblem?.slug}
              initialElapsed={initialElapsed}
              onStop={handleStopwatchStop}
              onTimeUpdate={(s) => {
                stopwatchSecondsRef.current = s;
              }}
              resetTrigger={resetTick}
              resumeTrigger={resumeTick}
            />
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

      {import.meta.env.DEV ? (
        <CodeCaptureDebugWidget currentProblemSlug={currentProblem?.slug} />
      ) : null}

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'chat' ? (
          <ChatPane
            messages={messages}
            input={input}
            loading={chatLoading}
            hintPrompts={HINT_PROMPTS}
            onChangeInput={setInput}
            onSend={handleSend}
            onSendHint={handleSendHint}
            codeAttachEnabled={attachCodeNext}
            codeAttachBusy={attachCodeBusy}
            onToggleCodeAttach={handleToggleCodeAttach}
            onClearHistory={clearCurrentProblemHistory}
          />
        ) : activeTab === 'interview' ? (
          interviewSession ? (
            <div className="p-4">
              <InterviewProgressCard
                session={interviewSession}
                stageChecklist={stageChecklist}
                onSetStatus={(itemId, status) =>
                  updateChecklist(itemId, status)
                }
                onAdvance={handleAdvanceStageFromUi}
                onComplete={handleFinishAndRateFromUi}
                onReset={resetSession}
              />
            </div>
          ) : null
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
