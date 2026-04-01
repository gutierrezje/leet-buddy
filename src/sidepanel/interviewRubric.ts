import type {
  InterviewChecklistItem,
  InterviewScore,
  InterviewSession,
  InterviewStage,
} from '@/shared/types';

export const STAGE_ORDER: InterviewStage[] = [
  'before_coding',
  'during_coding',
  'after_coding',
  'completed',
];

export const INTERVIEW_SESSION_PREFIX = 'interviewSession::';

const BASE_CHECKLIST: Omit<InterviewChecklistItem, 'status' | 'evidence'>[] = [
  {
    id: 'before_restate',
    stage: 'before_coding',
    label: 'Restated the problem in own words',
  },
  {
    id: 'before_constraints',
    stage: 'before_coding',
    label: 'Asked about constraints and edge cases',
  },
  {
    id: 'before_approaches',
    stage: 'before_coding',
    label: 'Discussed at least 2 approaches',
  },
  {
    id: 'before_complexity',
    stage: 'before_coding',
    label: 'Stated time/space complexity',
  },
  {
    id: 'before_go_ahead',
    stage: 'before_coding',
    label: 'Got go-ahead before coding',
  },
  {
    id: 'during_think_aloud',
    stage: 'during_coding',
    label: 'Talked through what they are writing',
  },
  {
    id: 'during_naming',
    stage: 'during_coding',
    label: 'Used meaningful variable names',
  },
  {
    id: 'during_clean_code',
    stage: 'during_coding',
    label: 'Wrote modular/clean code',
  },
  {
    id: 'during_edge_cases',
    stage: 'during_coding',
    label: 'Handled edge cases',
  },
  {
    id: 'after_walkthrough',
    stage: 'after_coding',
    label: 'Walked through code with an example',
  },
  {
    id: 'after_tested_edges',
    stage: 'after_coding',
    label: 'Tested edge cases manually',
  },
  {
    id: 'after_fixed_bugs',
    stage: 'after_coding',
    label: 'Identified and fixed bugs',
  },
  {
    id: 'after_optimizations',
    stage: 'after_coding',
    label: 'Discussed potential optimizations',
  },
];

export function getInterviewSessionKey(slug: string): string {
  return `${INTERVIEW_SESSION_PREFIX}${slug}`;
}

export function createInterviewSession(slug: string): InterviewSession {
  const now = Date.now();
  return {
    slug,
    stage: 'before_coding',
    checklist: BASE_CHECKLIST.map((item) => ({
      ...item,
      status: 'pending',
      evidence: [],
    })),
    goAheadViolated: false,
    startedAt: now,
    updatedAt: now,
  };
}

export function getChecklistByStage(
  session: InterviewSession,
  stage: Exclude<InterviewStage, 'completed'>
): InterviewChecklistItem[] {
  return session.checklist.filter((item) => item.stage === stage);
}

export function canAdvanceStage(session: InterviewSession): boolean {
  if (session.stage === 'completed') return false;
  const current = getChecklistByStage(session, session.stage);
  return current.every((item) => item.status === 'done');
}

export function nextStage(stage: InterviewStage): InterviewStage {
  const idx = STAGE_ORDER.indexOf(stage);
  if (idx === -1 || idx >= STAGE_ORDER.length - 1) return 'completed';
  return STAGE_ORDER[idx + 1];
}

function statusToScore(status: InterviewChecklistItem['status']): number {
  if (status === 'done') return 2;
  if (status === 'partial') return 1;
  return 0;
}

function average(items: InterviewChecklistItem[]): number {
  if (items.length === 0) return 0;
  const total = items.reduce(
    (acc, item) => acc + statusToScore(item.status),
    0
  );
  return (total / (items.length * 2)) * 100;
}

function recommendationFromScore(
  overall: number
): InterviewScore['recommendation'] {
  if (overall >= 90) return 'Strong Hire';
  if (overall >= 80) return 'Hire';
  if (overall >= 70) return 'Weak Hire';
  if (overall >= 60) return 'Weak Reject';
  if (overall >= 45) return 'Reject';
  return 'Strong Reject';
}

export function computeInterviewScore(
  session: InterviewSession
): InterviewScore {
  const before = getChecklistByStage(session, 'before_coding');
  const during = getChecklistByStage(session, 'during_coding');
  const after = getChecklistByStage(session, 'after_coding');

  const dsa =
    Math.round((average(before) * 0.6 + average(after) * 0.4) * 100) / 100;
  const communication =
    Math.round((average(before) * 0.5 + average(during) * 0.5) * 100) / 100;
  const coding = Math.round(average(during) * 100) / 100;
  const testing = Math.round(average(after) * 100) / 100;

  const elapsedSec = Math.max(
    1,
    Math.floor((Date.now() - session.startedAt) / 1000)
  );
  const speed = Math.min(
    100,
    Math.max(0, Math.round((1800 / elapsedSec) * 10000) / 100)
  );

  const overall =
    Math.round(
      (dsa * 0.3 +
        communication * 0.2 +
        coding * 0.2 +
        testing * 0.2 +
        speed * 0.1) *
        100
    ) / 100;

  return {
    dsa,
    communication,
    coding,
    testing,
    speed,
    overall,
    recommendation: recommendationFromScore(overall),
  };
}

export function stageLabel(stage: InterviewStage): string {
  if (stage === 'before_coding') return 'Before Coding';
  if (stage === 'during_coding') return 'During Coding';
  if (stage === 'after_coding') return 'After Coding';
  return 'Completed';
}
