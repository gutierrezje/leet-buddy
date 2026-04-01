import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  InterviewChecklistItem,
  InterviewSession,
  InterviewStage,
  InterviewStateUpdate,
} from '@/shared/types';
import { isSubmissionAcceptedMessage } from '@/shared/types';
import { createLogger } from '@/shared/utils/debug';
import {
  canAdvanceStage,
  createInterviewSession,
  getChecklistByStage,
  getInterviewSessionKey,
  nextStage,
} from '../interviewRubric';

const debug = createLogger('useInterviewSession');

function persistSession(session: InterviewSession) {
  const key = getInterviewSessionKey(session.slug);
  chrome.storage.local.set(
    { [key]: session },
    () => void chrome.runtime.lastError
  );
}

export function useInterviewSession(problemSlug?: string) {
  const [session, setSession] = useState<InterviewSession | null>(null);

  useEffect(() => {
    if (!problemSlug) {
      setSession(null);
      return;
    }

    const key = getInterviewSessionKey(problemSlug);
    chrome.storage.local.get([key], (data) => {
      const stored = data[key] as InterviewSession | undefined;
      if (stored?.slug === problemSlug) {
        setSession(stored);
        return;
      }

      const created = createInterviewSession(problemSlug);
      setSession(created);
      persistSession(created);
    });
  }, [problemSlug]);

  const updateChecklist = (
    itemId: string,
    status: InterviewChecklistItem['status'],
    evidence?: string
  ) => {
    setSession((prev) => {
      if (!prev) return prev;
      const next: InterviewSession = {
        ...prev,
        updatedAt: Date.now(),
        checklist: prev.checklist.map((item) => {
          if (item.id !== itemId) return item;
          return {
            ...item,
            status,
            evidence: evidence
              ? [...item.evidence, evidence].slice(-3)
              : item.evidence,
          };
        }),
      };
      persistSession(next);
      return next;
    });
  };

  const markCodingDetected = useCallback(() => {
    setSession((prev) => {
      if (!prev) return prev;
      if (prev.stage !== 'before_coding') return prev;

      const goAheadDone = prev.checklist.some(
        (item) => item.id === 'before_go_ahead' && item.status === 'done'
      );

      const next: InterviewSession = {
        ...prev,
        stage: 'during_coding',
        updatedAt: Date.now(),
        goAheadViolated: prev.goAheadViolated || !goAheadDone,
        checklist: prev.checklist.map((item) => {
          if (item.id !== 'before_go_ahead') return item;
          if (goAheadDone) return item;
          return {
            ...item,
            status: 'pending',
            evidence: [
              ...item.evidence,
              'Coding was detected before explicit GO-AHEAD.',
            ].slice(-3),
          };
        }),
      };

      persistSession(next);
      return next;
    });
  }, []);

  const setBaselineNonCommentFingerprint = useCallback(
    (fingerprint?: string) => {
      if (!fingerprint) return;
      setSession((prev) => {
        if (!prev) return prev;
        if (prev.baselineNonCommentFingerprint === fingerprint) return prev;

        const next: InterviewSession = {
          ...prev,
          baselineNonCommentFingerprint:
            prev.baselineNonCommentFingerprint || fingerprint,
          updatedAt: Date.now(),
        };
        persistSession(next);
        return next;
      });
    },
    []
  );

  const hasCandidateCodeChangedFromBaseline = useCallback(
    (fingerprint?: string) => {
      if (!fingerprint) return false;
      if (!session?.baselineNonCommentFingerprint) return false;
      return fingerprint !== session.baselineNonCommentFingerprint;
    },
    [session?.baselineNonCommentFingerprint]
  );

  const markSubmissionDetected = useCallback(() => {
    setSession((prev) => {
      if (!prev) return prev;
      if (prev.stage === 'after_coding' || prev.stage === 'completed')
        return prev;

      const next: InterviewSession = {
        ...prev,
        stage: 'after_coding',
        updatedAt: Date.now(),
      };

      persistSession(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const onMessage = (msg: unknown) => {
      if (!isSubmissionAcceptedMessage(msg)) return;
      if (!problemSlug || msg.slug !== problemSlug) return;
      markSubmissionDetected();
    };

    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, [problemSlug, markSubmissionDetected]);

  const applyStateUpdate = (update: InterviewStateUpdate) => {
    setSession((prev) => {
      if (!prev) return prev;

      const stage: InterviewStage = update.stage;
      const nextChecklist = prev.checklist.map((item) => {
        const patch = update.checklist.find(
          (entry) => entry.itemId === item.id
        );
        if (!patch) return item;
        return {
          ...item,
          status: patch.status,
          evidence: patch.evidence
            ? [...item.evidence, patch.evidence].slice(-3)
            : item.evidence,
        };
      });

      const next: InterviewSession = {
        ...prev,
        stage,
        checklist: nextChecklist,
        updatedAt: Date.now(),
        completedAt:
          stage === 'completed'
            ? prev.completedAt || Date.now()
            : prev.completedAt,
        score: update.score ?? prev.score,
      };

      persistSession(next);
      return next;
    });
  };

  const advanceStage = () => {
    setSession((prev) => {
      if (!prev) return prev;

      const next = {
        ...prev,
        stage: nextStage(prev.stage),
        updatedAt: Date.now(),
      };
      persistSession(next);
      return next;
    });
  };

  const completeWithoutScore = () => {
    setSession((prev) => {
      if (!prev) return prev;
      const next: InterviewSession = {
        ...prev,
        stage: 'completed',
        completedAt: Date.now(),
        updatedAt: Date.now(),
      };
      persistSession(next);
      return next;
    });
  };

  const resetSession = () => {
    if (!problemSlug) return;
    const fresh = createInterviewSession(problemSlug);
    setSession(fresh);
    persistSession(fresh);
  };

  const stageChecklist = useMemo(() => {
    if (!session || session.stage === 'completed') return [];
    return getChecklistByStage(session, session.stage);
  }, [session]);

  const canAdvance = session ? canAdvanceStage(session) : false;

  useEffect(() => {
    if (!session) return;
    debug('Interview stage: %s', session.stage);
  }, [session]);

  return {
    session,
    stageChecklist,
    canAdvance,
    updateChecklist,
    applyStateUpdate,
    markCodingDetected,
    setBaselineNonCommentFingerprint,
    hasCandidateCodeChangedFromBaseline,
    markSubmissionDetected,
    advanceStage,
    completeWithoutScore,
    resetSession,
  };
}
