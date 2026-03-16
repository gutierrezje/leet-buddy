import { useEffect, useReducer, useRef, useState } from 'react';
import {
  appendSubmissionAttempt,
  getLatestSubmission,
  getSubmissionHistory,
} from '@/shared/submissions';
import {
  type CurrentProblem,
  isSubmissionAcceptedMessage,
} from '@/shared/types';
import { createLogger } from '@/shared/utils/debug';

const debug = createLogger('useSubmissionFlow');

interface UseSubmissionFlowProps {
  currentProblem: CurrentProblem | null;
  getStopwatchElapsed: () => number;
}

// Typed state boundaries for submission flow
type SubmissionState =
  | { status: 'idle' }
  | {
      status: 'modal-open';
      elapsedSec: number;
      source: 'auto' | 'manual';
      submissionId: string | null;
      prevTime: number | undefined;
    };

type SubmissionAction =
  | {
      type: 'OPEN_MODAL';
      elapsedSec: number;
      source: 'auto' | 'manual';
      submissionId: string | null;
      prevTime: number | undefined;
    }
  | { type: 'CANCEL' }
  | { type: 'CONFIRM' };

function submissionReducer(
  state: SubmissionState,
  action: SubmissionAction
): SubmissionState {
  switch (action.type) {
    case 'OPEN_MODAL':
      return {
        status: 'modal-open',
        elapsedSec: action.elapsedSec,
        source: action.source,
        submissionId: action.submissionId,
        prevTime: action.prevTime,
      };
    case 'CANCEL':
    case 'CONFIRM':
      return { status: 'idle' };
    default:
      return state;
  }
}

export function useSubmissionFlow({
  currentProblem,
  getStopwatchElapsed,
}: UseSubmissionFlowProps) {
  const [state, dispatch] = useReducer(submissionReducer, { status: 'idle' });
  const [resetTick, setResetTick] = useState(0);
  const [resumeTick, setResumeTick] = useState(0);

  // Use ref to avoid stale closure in message listener
  const currentProblemRef = useRef<CurrentProblem | null>(currentProblem);
  const getStopwatchElapsedRef = useRef(getStopwatchElapsed);

  useEffect(() => {
    getStopwatchElapsedRef.current = getStopwatchElapsed;
  }, [getStopwatchElapsed]);

  useEffect(() => {
    // If the problem changes, clear any pending modal state
    if (currentProblemRef.current?.slug !== currentProblem?.slug) {
      dispatch({ type: 'CANCEL' });
    }
    currentProblemRef.current = currentProblem;
  }, [currentProblem?.slug, currentProblem]);

  async function handleStopwatchStop(elapsed: number) {
    if (!currentProblem?.slug) return;

    const prevSubmission = await getLatestSubmission(currentProblem.slug);

    dispatch({
      type: 'OPEN_MODAL',
      elapsedSec: elapsed,
      source: 'manual',
      submissionId: null,
      prevTime: prevSubmission?.elapsedSec,
    });
  }

  function handleCancelSave() {
    if (state.status === 'modal-open' && state.source === 'manual') {
      setResumeTick((t) => t + 1);
    }
    dispatch({ type: 'CANCEL' });
  }

  function handleConfirmSave(finalElapsedSec: number) {
    if (!currentProblem) {
      debug('Cannot save submission: no current problem');
      return;
    }

    if (state.status !== 'modal-open') {
      debug('Cannot confirm save: modal not open');
      return;
    }

    const now = Date.now();
    const submissionId =
      state.source === 'auto'
        ? state.submissionId || `auto-${now}`
        : `manual-${now}`;

    appendSubmissionAttempt(currentProblem.slug, {
      submissionId,
      source: state.source,
      elapsedSec: finalElapsedSec,
      problem: currentProblem,
      at: now,
    });

    dispatch({ type: 'CONFIRM' });
    setResetTick((t) => t + 1);
  }

  // Subscribe to auto-submission messages
  useEffect(() => {
    async function handleMessage(msg: unknown) {
      if (isSubmissionAcceptedMessage(msg)) {
        debug('Auto-detected accepted submission for %s', msg.slug);

        const problem = currentProblemRef.current;
        if (!problem || problem.slug !== msg.slug) {
          debug('Current problem mismatch with the submission slug.');
          return;
        }

        const history = await getSubmissionHistory(problem.slug);
        if (history.some((sub) => sub.submissionId === msg.submissionId)) {
          return; // already recorded
        }

        // For the prevTime label, we still want just the absolute latest attempt
        const existing = await getLatestSubmission(problem.slug);

        // If the stopwatch hasn't ticked or the ref is somehow 0, fallback to the background tracked time
        const refElapsed = getStopwatchElapsedRef.current();
        const elapsedSec =
          refElapsed > 0
            ? refElapsed
            : problem.startAt
              ? Math.floor((msg.at - problem.startAt) / 1000)
              : 0;

        dispatch({
          type: 'OPEN_MODAL',
          elapsedSec,
          source: 'auto',
          submissionId: msg.submissionId,
          prevTime: existing?.elapsedSec,
        });
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  // Derive values from state for backward compatibility
  const saveOpen = state.status === 'modal-open';
  const stoppedSec = state.status === 'modal-open' ? state.elapsedSec : 0;
  const prevTime = state.status === 'modal-open' ? state.prevTime : undefined;

  return {
    saveOpen,
    stoppedSec,
    resetTick,
    resumeTick,
    prevTime,
    handleStopwatchStop,
    handleCancelSave,
    handleConfirmSave,
  };
}
