import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  DerivedFinalAssessment,
  InterviewEvidenceInput,
  InterviewSession,
  InterviewStateUpdate,
} from '@/shared/types';
import { isSubmissionAcceptedMessage } from '@/shared/types';
import { createLogger } from '@/shared/utils/debug';
import {
  advanceInterviewStage,
  buildFinalAssessmentSummary,
  canAdvanceStage,
  createInterviewSession,
  finalizeInterviewSession,
  getChecklistByStage,
  getInterviewSessionKey,
  nextStage,
  recordInterviewEvidence,
  withInterviewRationale,
} from '../interviewRubric';

const debug = createLogger('useInterviewSession');

function persistSession(session: InterviewSession) {
  const key = getInterviewSessionKey(session.slug);
  chrome.storage.local.set(
    { [key]: session },
    () => void chrome.runtime.lastError
  );
}

function isInterviewSessionV2(value: unknown): value is InterviewSession {
  if (!value || typeof value !== 'object') return false;
  const session = value as InterviewSession;
  return (
    session.version === 2 &&
    typeof session.slug === 'string' &&
    Array.isArray(session.evidenceLog) &&
    Boolean(session.derivedState)
  );
}

function applyAndPersist(
  prev: InterviewSession | null,
  updater: (session: InterviewSession) => InterviewSession
): InterviewSession | null {
  if (!prev) return prev;
  const next = updater(prev);
  if (next !== prev) {
    persistSession(next);
  }
  return next;
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
      const stored = data[key];
      if (isInterviewSessionV2(stored) && stored.slug === problemSlug) {
        setSession(stored);
        return;
      }

      const created = createInterviewSession(problemSlug);
      setSession(created);
      persistSession(created);
    });
  }, [problemSlug]);

  const appendEvidence = useCallback((events: InterviewEvidenceInput[]) => {
    setSession((prev) =>
      applyAndPersist(prev, (current) =>
        recordInterviewEvidence(current, events)
      )
    );
  }, []);

  const markCodingDetected = useCallback(() => {
    setSession((prev) =>
      applyAndPersist(prev, (current) => {
        if (current.derivedState.stage !== 'before_coding') return current;

        const events: InterviewEvidenceInput[] = [
          {
            kind: 'coding_started',
            source: 'code',
            snippet: 'Candidate code changed from the captured baseline.',
            confidence: 0.95,
            stageHint: 'during_coding',
          },
        ];

        if (
          !current.derivedState.coverage.some(
            (item) => item.id === 'before_go_ahead' && item.status === 'done'
          )
        ) {
          events.push({
            kind: 'early_coding_violation',
            source: 'system',
            snippet: 'Coding was detected before explicit GO-AHEAD.',
            confidence: 1,
            stageHint: 'before_coding',
          });
        }

        return recordInterviewEvidence(current, events);
      })
    );
  }, []);

  const setBaselineNonCommentFingerprint = useCallback(
    (fingerprint?: string) => {
      if (!fingerprint) return;
      setSession((prev) =>
        applyAndPersist(prev, (current) => {
          if (current.baselineNonCommentFingerprint === fingerprint) {
            return current;
          }

          return {
            ...current,
            baselineNonCommentFingerprint:
              current.baselineNonCommentFingerprint || fingerprint,
            updatedAt: Date.now(),
          };
        })
      );
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
    setSession((prev) =>
      applyAndPersist(prev, (current) => {
        if (
          current.derivedState.stage === 'after_coding' ||
          current.derivedState.stage === 'completed'
        ) {
          return current;
        }

        return recordInterviewEvidence(current, [
          {
            kind: 'submission_detected',
            source: 'system',
            snippet: 'An accepted submission was detected.',
            confidence: 1,
            stageHint: 'after_coding',
          },
        ]);
      })
    );
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
    setSession((prev) =>
      applyAndPersist(prev, (current) => {
        let next = current;

        if (update.events && update.events.length > 0) {
          next = recordInterviewEvidence(next, update.events);
        }

        if (update.suggestedStage) {
          next = advanceInterviewStage(
            next,
            update.suggestedStage,
            'llm',
            update.stageReason ||
              `Suggested transition to ${update.suggestedStage}.`
          );
        }

        if (update.finalRecommendation || next.finalAssessment) {
          next = finalizeInterviewSession(
            next,
            update.finalRecommendation ?? next.finalAssessment?.recommendation,
            update.finalRationale ?? next.finalAssessment?.rationale
          );
        }

        if (update.finalRationale && next.finalAssessment) {
          next = withInterviewRationale(next, update.finalRationale);
        }

        return next;
      })
    );
  };

  const advanceStage = () => {
    setSession((prev) =>
      applyAndPersist(prev, (current) => {
        const target = nextStage(current.derivedState.stage);
        if (target !== 'during_coding' && target !== 'after_coding') {
          return current;
        }
        return advanceInterviewStage(
          current,
          target,
          'ui',
          `User advanced the interview to ${target}.`
        );
      })
    );
  };

  const completeWithoutScore = () => {
    setSession((prev) =>
      applyAndPersist(prev, (current) => finalizeInterviewSession(current))
    );
  };

  const resetSession = () => {
    if (!problemSlug) return;
    const fresh = createInterviewSession(problemSlug);
    setSession(fresh);
    persistSession(fresh);
  };

  const stageChecklist = useMemo(() => {
    if (!session || session.derivedState.stage === 'completed') return [];
    return getChecklistByStage(session, session.derivedState.stage);
  }, [session]);

  const canAdvance = session ? canAdvanceStage(session) : false;
  const deterministicFinalAssessment: DerivedFinalAssessment | undefined =
    useMemo(() => {
      if (!session) return undefined;
      return buildFinalAssessmentSummary(session);
    }, [session]);

  useEffect(() => {
    if (!session) return;
    debug('Interview stage: %s', session.derivedState.stage);
  }, [session]);

  return {
    session,
    stageChecklist,
    canAdvance,
    applyStateUpdate,
    appendEvidence,
    markCodingDetected,
    setBaselineNonCommentFingerprint,
    hasCandidateCodeChangedFromBaseline,
    markSubmissionDetected,
    advanceStage,
    completeWithoutScore,
    deterministicFinalAssessment,
    resetSession,
  };
}
