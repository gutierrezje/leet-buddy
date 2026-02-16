import { useEffect, useReducer, useRef, useState } from 'react';
import {
  appendSubmissionAttempt,
  getLatestSubmission,
} from '@/shared/submissions';
import {
  type CurrentProblem,
  isSubmissionAcceptedMessage,
} from '@/shared/types';
import { createLogger } from '@/shared/utils/debug';

const debug = createLogger('useSubmissionFlow');

interface UseSubmissionFlowProps {
  currentProblem: CurrentProblem | null;
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

export function useSubmissionFlow({ currentProblem }: UseSubmissionFlowProps) {
  const [state, dispatch] = useReducer(submissionReducer, { status: 'idle' });
  const [resetTick, setResetTick] = useState(0);

  // Use ref to avoid stale closure in message listener
  const currentProblemRef = useRef<CurrentProblem | null>(currentProblem);

  useEffect(() => {
    currentProblemRef.current = currentProblem;
  }, [currentProblem]);

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

        const existing = await getLatestSubmission(problem.slug);
        if (existing?.submissionId === msg.submissionId) {
          return; // already recorded
        }

        const endAt = msg.at;
        const elapsedSec = problem.startAt
          ? Math.floor((endAt - problem.startAt) / 1000)
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
    prevTime,
    handleStopwatchStop,
    handleCancelSave,
    handleConfirmSave,
  };
}
