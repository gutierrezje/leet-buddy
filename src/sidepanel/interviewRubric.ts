import type {
  DerivedFinalAssessment,
  InterviewChecklistItem,
  InterviewEvidenceEvent,
  InterviewEvidenceInput,
  InterviewEvidenceKind,
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
export const FINAL_ASSESSMENT_PREFIX = 'FINAL_ASSESSMENT::';

export const INTERVIEW_EVIDENCE_KINDS: InterviewEvidenceKind[] = [
  'problem_restatement',
  'constraints_discussed',
  'edge_cases_discussed',
  'approach_discussed',
  'multiple_approaches_discussed',
  'approach_selected',
  'approach_rejected',
  'complexity_time_discussed',
  'complexity_space_discussed',
  'go_ahead_given',
  'coding_started',
  'early_coding_violation',
  'think_aloud',
  'meaningful_naming',
  'clean_code',
  'edge_case_handling',
  'walkthrough_example',
  'manual_testing',
  'bug_identified',
  'bug_fixed',
  'optimization_discussed',
  'submission_detected',
  'stage_transition',
];

type CoverageSpec = {
  id: string;
  stage: Exclude<InterviewStage, 'completed'>;
  label: string;
  strengthLabel: string;
  evaluate: (events: InterviewEvidenceEvent[]) => InterviewChecklistItem;
};

type StageCandidate = Exclude<InterviewStage, 'completed'>;

function eventConfidence(event: InterviewEvidenceEvent): number {
  return Number.isFinite(event.confidence) ? event.confidence : 0.5;
}

function findEvents(
  events: InterviewEvidenceEvent[],
  ...kinds: InterviewEvidenceKind[]
): InterviewEvidenceEvent[] {
  const wanted = new Set(kinds);
  return events
    .filter((event) => wanted.has(event.kind))
    .sort((a, b) => a.createdAt - b.createdAt);
}

function hasEvent(
  events: InterviewEvidenceEvent[],
  kind: InterviewEvidenceKind,
  minConfidence = 0.55
): boolean {
  return events.some(
    (event) => event.kind === kind && eventConfidence(event) >= minConfidence
  );
}

function snippetsFor(
  events: InterviewEvidenceEvent[],
  kinds: InterviewEvidenceKind[],
  limit = 2
): string[] {
  const wanted = new Set(kinds);
  return events
    .filter((event) => wanted.has(event.kind))
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((event) => event.snippet.trim())
    .filter((snippet) => snippet.length > 0)
    .filter((snippet, index, all) => all.indexOf(snippet) === index)
    .slice(0, limit);
}

function makeCoverageItem(
  id: string,
  stage: Exclude<InterviewStage, 'completed'>,
  label: string,
  status: InterviewChecklistItem['status'],
  evidence: string[]
): InterviewChecklistItem {
  return {
    id,
    stage,
    label,
    status,
    evidence,
  };
}

function evaluateBooleanPair(
  events: InterviewEvidenceEvent[],
  config: {
    id: string;
    stage: Exclude<InterviewStage, 'completed'>;
    label: string;
    primary: InterviewEvidenceKind;
    secondary: InterviewEvidenceKind;
  }
): InterviewChecklistItem {
  const primaryDone = hasEvent(events, config.primary);
  const secondaryDone = hasEvent(events, config.secondary);
  const status =
    primaryDone && secondaryDone
      ? 'done'
      : primaryDone || secondaryDone
        ? 'partial'
        : 'pending';
  return makeCoverageItem(
    config.id,
    config.stage,
    config.label,
    status,
    snippetsFor(events, [config.primary, config.secondary])
  );
}

function readPayloadString(
  event: InterviewEvidenceEvent | undefined,
  key: string
): string | undefined {
  if (!event?.payload) return undefined;
  const value = event.payload[key];
  return typeof value === 'string' ? value : undefined;
}

function readPayloadStrings(
  event: InterviewEvidenceEvent | undefined,
  key: string
): string[] {
  if (!event?.payload) return [];
  const value = event.payload[key];
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

const COVERAGE_SPECS: CoverageSpec[] = [
  {
    id: 'before_restate',
    stage: 'before_coding',
    label: 'Restated the problem in own words',
    strengthLabel: 'Restated the problem clearly',
    evaluate: (events) =>
      makeCoverageItem(
        'before_restate',
        'before_coding',
        'Restated the problem in own words',
        hasEvent(events, 'problem_restatement') ? 'done' : 'pending',
        snippetsFor(events, ['problem_restatement'])
      ),
  },
  {
    id: 'before_constraints',
    stage: 'before_coding',
    label: 'Asked about constraints and edge cases',
    strengthLabel: 'Covered constraints and edge cases',
    evaluate: (events) =>
      evaluateBooleanPair(events, {
        id: 'before_constraints',
        stage: 'before_coding',
        label: 'Asked about constraints and edge cases',
        primary: 'constraints_discussed',
        secondary: 'edge_cases_discussed',
      }),
  },
  {
    id: 'before_approaches',
    stage: 'before_coding',
    label: 'Discussed at least 2 approaches',
    strengthLabel: 'Compared multiple approaches',
    evaluate: (events) => {
      const discussionEvents = findEvents(events, 'approach_discussed');
      const alternatives =
        new Set(
          discussionEvents
            .map(
              (event) => readPayloadString(event, 'approach') ?? event.snippet
            )
            .filter(Boolean)
        ).size ?? 0;
      const status = hasEvent(events, 'multiple_approaches_discussed')
        ? 'done'
        : alternatives >= 2
          ? 'done'
          : alternatives === 1 || hasEvent(events, 'approach_selected')
            ? 'partial'
            : 'pending';
      return makeCoverageItem(
        'before_approaches',
        'before_coding',
        'Discussed at least 2 approaches',
        status,
        snippetsFor(
          events,
          [
            'approach_discussed',
            'multiple_approaches_discussed',
            'approach_selected',
            'approach_rejected',
          ],
          3
        )
      );
    },
  },
  {
    id: 'before_complexity',
    stage: 'before_coding',
    label: 'Stated time/space complexity',
    strengthLabel: 'Stated time and space complexity',
    evaluate: (events) =>
      evaluateBooleanPair(events, {
        id: 'before_complexity',
        stage: 'before_coding',
        label: 'Stated time/space complexity',
        primary: 'complexity_time_discussed',
        secondary: 'complexity_space_discussed',
      }),
  },
  {
    id: 'before_go_ahead',
    stage: 'before_coding',
    label: 'Got go-ahead before coding',
    strengthLabel: 'Waited for go-ahead before coding',
    evaluate: (events) => {
      const goAheadDone = hasEvent(events, 'go_ahead_given');
      const violated = hasEvent(events, 'early_coding_violation', 0.4);
      return makeCoverageItem(
        'before_go_ahead',
        'before_coding',
        'Got go-ahead before coding',
        goAheadDone && !violated ? 'done' : violated ? 'pending' : 'partial',
        snippetsFor(events, ['go_ahead_given', 'early_coding_violation'])
      );
    },
  },
  {
    id: 'during_think_aloud',
    stage: 'during_coding',
    label: 'Talked through what they are writing',
    strengthLabel: 'Explained coding decisions while writing',
    evaluate: (events) =>
      makeCoverageItem(
        'during_think_aloud',
        'during_coding',
        'Talked through what they are writing',
        hasEvent(events, 'think_aloud') ? 'done' : 'pending',
        snippetsFor(events, ['think_aloud'])
      ),
  },
  {
    id: 'during_naming',
    stage: 'during_coding',
    label: 'Used meaningful variable names',
    strengthLabel: 'Used meaningful names',
    evaluate: (events) =>
      makeCoverageItem(
        'during_naming',
        'during_coding',
        'Used meaningful variable names',
        hasEvent(events, 'meaningful_naming') ? 'done' : 'pending',
        snippetsFor(events, ['meaningful_naming'])
      ),
  },
  {
    id: 'during_clean_code',
    stage: 'during_coding',
    label: 'Wrote modular/clean code',
    strengthLabel: 'Produced clean modular code',
    evaluate: (events) =>
      makeCoverageItem(
        'during_clean_code',
        'during_coding',
        'Wrote modular/clean code',
        hasEvent(events, 'clean_code') ? 'done' : 'pending',
        snippetsFor(events, ['clean_code'])
      ),
  },
  {
    id: 'during_edge_cases',
    stage: 'during_coding',
    label: 'Handled edge cases',
    strengthLabel: 'Handled edge cases in code',
    evaluate: (events) =>
      makeCoverageItem(
        'during_edge_cases',
        'during_coding',
        'Handled edge cases',
        hasEvent(events, 'edge_case_handling') ? 'done' : 'pending',
        snippetsFor(events, ['edge_case_handling'])
      ),
  },
  {
    id: 'after_walkthrough',
    stage: 'after_coding',
    label: 'Walked through code with an example',
    strengthLabel: 'Walked through the solution with an example',
    evaluate: (events) =>
      makeCoverageItem(
        'after_walkthrough',
        'after_coding',
        'Walked through code with an example',
        hasEvent(events, 'walkthrough_example') ? 'done' : 'pending',
        snippetsFor(events, ['walkthrough_example'])
      ),
  },
  {
    id: 'after_tested_edges',
    stage: 'after_coding',
    label: 'Tested edge cases manually',
    strengthLabel: 'Tested edge cases manually',
    evaluate: (events) =>
      makeCoverageItem(
        'after_tested_edges',
        'after_coding',
        'Tested edge cases manually',
        hasEvent(events, 'manual_testing') ? 'done' : 'pending',
        snippetsFor(events, ['manual_testing'])
      ),
  },
  {
    id: 'after_fixed_bugs',
    stage: 'after_coding',
    label: 'Identified and fixed bugs',
    strengthLabel: 'Found and fixed bugs',
    evaluate: (events) => {
      const identified = hasEvent(events, 'bug_identified');
      const fixed = hasEvent(events, 'bug_fixed');
      const status =
        identified && fixed
          ? 'done'
          : identified || fixed
            ? 'partial'
            : 'pending';
      return makeCoverageItem(
        'after_fixed_bugs',
        'after_coding',
        'Identified and fixed bugs',
        status,
        snippetsFor(events, ['bug_identified', 'bug_fixed'])
      );
    },
  },
  {
    id: 'after_optimizations',
    stage: 'after_coding',
    label: 'Discussed potential optimizations',
    strengthLabel: 'Discussed follow-up optimizations',
    evaluate: (events) =>
      makeCoverageItem(
        'after_optimizations',
        'after_coding',
        'Discussed potential optimizations',
        hasEvent(events, 'optimization_discussed') ? 'done' : 'pending',
        snippetsFor(events, ['optimization_discussed'])
      ),
  },
];

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

function getLastStageTransition(
  events: InterviewEvidenceEvent[]
): StageCandidate | null {
  const transitions = findEvents(events, 'stage_transition');
  for (let index = transitions.length - 1; index >= 0; index -= 1) {
    const candidate =
      readPayloadString(transitions[index], 'to') ??
      transitions[index].stageHint;
    if (
      candidate === 'before_coding' ||
      candidate === 'during_coding' ||
      candidate === 'after_coding'
    ) {
      return candidate;
    }
  }
  return null;
}

function dedupeStrings(values: string[], limit = values.length): string[] {
  return values
    .filter((value, index, all) => all.indexOf(value) === index)
    .slice(0, limit);
}

function deriveStage(
  events: InterviewEvidenceEvent[],
  finalAssessment?: DerivedFinalAssessment
): InterviewStage {
  if (finalAssessment) return 'completed';

  const transitioned = getLastStageTransition(events);
  const sawAfterEvidence =
    transitioned === 'after_coding' ||
    hasEvent(events, 'submission_detected') ||
    hasEvent(events, 'walkthrough_example', 0.4) ||
    hasEvent(events, 'manual_testing', 0.4) ||
    hasEvent(events, 'bug_fixed', 0.4) ||
    hasEvent(events, 'optimization_discussed', 0.4);

  if (sawAfterEvidence) return 'after_coding';

  const sawDuringEvidence =
    transitioned === 'during_coding' ||
    hasEvent(events, 'coding_started', 0.4) ||
    hasEvent(events, 'think_aloud', 0.4) ||
    hasEvent(events, 'clean_code', 0.4) ||
    hasEvent(events, 'meaningful_naming', 0.4) ||
    hasEvent(events, 'edge_case_handling', 0.4);

  if (sawDuringEvidence) return 'during_coding';

  return 'before_coding';
}

function deriveApproachSummary(events: InterviewEvidenceEvent[]) {
  const discussed = findEvents(
    events,
    'approach_discussed',
    'approach_selected',
    'approach_rejected'
  );

  const selected = [...discussed]
    .reverse()
    .map((event) => readPayloadString(event, 'approach') ?? event.snippet)
    .find(Boolean);

  const alternatives = dedupeStrings(
    discussed
      .map((event) => readPayloadString(event, 'approach') ?? event.snippet)
      .filter(Boolean),
    4
  );

  return {
    selected,
    alternatives,
  };
}

function deriveComplexityClaims(events: InterviewEvidenceEvent[]) {
  const timeEvent = [...findEvents(events, 'complexity_time_discussed')].pop();
  const spaceEvent = [
    ...findEvents(events, 'complexity_space_discussed'),
  ].pop();

  return {
    time: readPayloadString(timeEvent, 'value') ?? timeEvent?.snippet,
    space: readPayloadString(spaceEvent, 'value') ?? spaceEvent?.snippet,
  };
}

function deriveEdgeCasesMentioned(events: InterviewEvidenceEvent[]): string[] {
  const edgeEvents = findEvents(
    events,
    'edge_cases_discussed',
    'edge_case_handling'
  );
  const payloadCases = edgeEvents.flatMap((event) =>
    readPayloadStrings(event, 'edgeCases')
  );
  const snippets = edgeEvents.map((event) => event.snippet).filter(Boolean);
  return dedupeStrings([...payloadCases, ...snippets], 4);
}

function buildFinalAssessmentToken(score: InterviewScore): string {
  return `${FINAL_ASSESSMENT_PREFIX}${JSON.stringify(score)}`;
}

function deriveRecommendedNextStage(
  stage: InterviewStage,
  readyToAdvance: boolean
): Exclude<InterviewStage, 'completed'> | undefined {
  if (!readyToAdvance || stage === 'completed' || stage === 'after_coding') {
    return undefined;
  }

  if (stage === 'before_coding') return 'during_coding';
  return 'after_coding';
}

export function stageLabel(stage: InterviewStage): string {
  if (stage === 'before_coding') return 'Before Coding';
  if (stage === 'during_coding') return 'During Coding';
  if (stage === 'after_coding') return 'After Coding';
  return 'Completed';
}

export function getInterviewSessionKey(slug: string): string {
  return `${INTERVIEW_SESSION_PREFIX}${slug}`;
}

export function getChecklistByStage(
  session: InterviewSession,
  stage: Exclude<InterviewStage, 'completed'>
): InterviewChecklistItem[] {
  return session.derivedState.coverage.filter((item) => item.stage === stage);
}

export function nextStage(stage: InterviewStage): InterviewStage {
  const idx = STAGE_ORDER.indexOf(stage);
  if (idx === -1 || idx >= STAGE_ORDER.length - 1) return 'completed';
  return STAGE_ORDER[idx + 1];
}

export function canAdvanceStage(session: InterviewSession): boolean {
  if (session.derivedState.stage === 'completed') return false;
  return session.derivedState.readyToAdvance;
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

export function deriveInterviewState(
  events: InterviewEvidenceEvent[],
  finalAssessment?: DerivedFinalAssessment
): InterviewSession['derivedState'] {
  const coverage = COVERAGE_SPECS.map((spec) => spec.evaluate(events));
  const stage = deriveStage(events, finalAssessment);
  const currentStageChecklist =
    stage === 'completed'
      ? coverage
      : coverage.filter((item) => item.stage === stage);
  const missingAreas = currentStageChecklist
    .filter((item) => item.status !== 'done')
    .map((item) => item.label);
  const strengths = COVERAGE_SPECS.filter(
    (spec) => coverage.find((item) => item.id === spec.id)?.status === 'done'
  )
    .map((spec) => spec.strengthLabel)
    .slice(0, 4);
  const recentEvidence = dedupeStrings(
    [...events]
      .sort((a, b) => b.createdAt - a.createdAt)
      .filter((event) => eventConfidence(event) >= 0.6)
      .map((event) => event.snippet.trim())
      .filter(Boolean),
    5
  );
  const acknowledgedAccomplishments = currentStageChecklist
    .filter((item) => item.status === 'done')
    .map((item) => item.label)
    .slice(0, 3);
  const readyToAdvance =
    stage !== 'completed' &&
    currentStageChecklist.length > 0 &&
    currentStageChecklist.every((item) => item.status === 'done');

  return {
    stage,
    stageLabel: stageLabel(stage),
    coverage,
    currentStageChecklist,
    missingAreas,
    strengths,
    recentEvidence,
    acknowledgedAccomplishments,
    nextFollowUp: missingAreas[0] ?? null,
    approachSummary: deriveApproachSummary(events),
    complexityClaims: deriveComplexityClaims(events),
    edgeCasesMentioned: deriveEdgeCasesMentioned(events),
    readyToAdvance,
    recommendedNextStage: deriveRecommendedNextStage(stage, readyToAdvance),
  };
}

export function createInterviewSession(slug: string): InterviewSession {
  const now = Date.now();
  return {
    version: 2,
    slug,
    evidenceLog: [],
    derivedState: deriveInterviewState([]),
    startedAt: now,
    updatedAt: now,
    nextEventSeq: 1,
  };
}

function normalizeEvidenceInput(
  session: InterviewSession,
  input: InterviewEvidenceInput,
  now: number,
  index: number
): InterviewEvidenceEvent {
  return {
    id: `${session.slug}-evt-${session.nextEventSeq + index}`,
    kind: input.kind,
    stageHint: input.stageHint,
    source: input.source ?? 'system',
    turnId: input.turnId ?? `turn-${now}`,
    snippet: input.snippet.trim(),
    confidence:
      typeof input.confidence === 'number'
        ? Math.max(0, Math.min(1, input.confidence))
        : 0.75,
    createdAt: now + index,
    payload: input.payload,
  };
}

export function recordInterviewEvidence(
  session: InterviewSession,
  inputs: InterviewEvidenceInput[],
  now = Date.now()
): InterviewSession {
  if (inputs.length === 0) return session;

  const normalized = inputs.map((input, index) =>
    normalizeEvidenceInput(session, input, now, index)
  );
  const nextBase: InterviewSession = {
    ...session,
    evidenceLog: [...session.evidenceLog, ...normalized].slice(-200),
    updatedAt: now,
    nextEventSeq: session.nextEventSeq + normalized.length,
  };

  const finalAssessment = nextBase.finalAssessment
    ? {
        ...computeInterviewScore(nextBase),
        recommendation: nextBase.finalAssessment.recommendation,
        summaryToken: buildFinalAssessmentToken(
          computeInterviewScore(nextBase)
        ),
        rationale: nextBase.finalAssessment.rationale,
      }
    : undefined;

  return {
    ...nextBase,
    finalAssessment,
    derivedState: deriveInterviewState(nextBase.evidenceLog, finalAssessment),
  };
}

function stageIndex(stage: InterviewStage): number {
  return STAGE_ORDER.indexOf(stage);
}

function canMoveToStage(
  session: InterviewSession,
  target: StageCandidate
): boolean {
  const current = session.derivedState.stage;
  if (current === 'completed') return false;
  if (stageIndex(target) <= stageIndex(current)) return false;

  if (target === 'during_coding') {
    const beforeItems = getChecklistByStage(session, 'before_coding');
    const requiredBeforeItems = beforeItems.filter(
      (item) => item.id !== 'before_go_ahead'
    );
    return (
      session.derivedState.stage === 'before_coding' &&
      requiredBeforeItems.length > 0 &&
      requiredBeforeItems.every((item) => item.status === 'done')
    );
  }

  if (target === 'after_coding') {
    return (
      session.derivedState.stage === 'during_coding' &&
      (canAdvanceStage(session) ||
        hasEvent(session.evidenceLog, 'submission_detected', 0.4))
    );
  }

  return false;
}

export function advanceInterviewStage(
  session: InterviewSession,
  target: StageCandidate,
  source: 'llm' | 'ui' | 'system',
  reason: string,
  now = Date.now()
): InterviewSession {
  if (!canMoveToStage(session, target)) return session;

  const inputs: InterviewEvidenceInput[] = [
    {
      kind: 'stage_transition',
      stageHint: target,
      source,
      snippet: reason,
      confidence: 0.9,
      payload: { to: target },
    },
  ];

  if (
    target === 'during_coding' &&
    !hasEvent(session.evidenceLog, 'go_ahead_given', 0.4)
  ) {
    inputs.unshift({
      kind: 'go_ahead_given',
      stageHint: 'before_coding',
      source,
      snippet: 'GO-AHEAD granted to start coding.',
      confidence: 0.95,
    });
  }

  return recordInterviewEvidence(session, inputs, now);
}

export function recommendationWithinBand(
  deterministic: InterviewScore['recommendation'],
  proposed: InterviewScore['recommendation']
): boolean {
  const ordered: InterviewScore['recommendation'][] = [
    'Strong Reject',
    'Reject',
    'Weak Reject',
    'Weak Hire',
    'Hire',
    'Strong Hire',
  ];
  const deterministicIndex = ordered.indexOf(deterministic);
  const proposedIndex = ordered.indexOf(proposed);
  return Math.abs(deterministicIndex - proposedIndex) <= 1;
}

export function finalizeInterviewSession(
  session: InterviewSession,
  recommendation?: InterviewScore['recommendation'],
  rationale?: string,
  now = Date.now()
): InterviewSession {
  const score = computeInterviewScore(session);
  const boundedRecommendation =
    recommendation &&
    recommendationWithinBand(score.recommendation, recommendation)
      ? recommendation
      : score.recommendation;
  const finalAssessment: DerivedFinalAssessment = {
    ...score,
    recommendation: boundedRecommendation,
    summaryToken: buildFinalAssessmentToken(score),
    rationale,
  };

  const next: InterviewSession = {
    ...session,
    finalAssessment,
    completedAt: session.completedAt ?? now,
    updatedAt: now,
  };

  return {
    ...next,
    derivedState: deriveInterviewState(next.evidenceLog, finalAssessment),
  };
}

export function withInterviewRationale(
  session: InterviewSession,
  rationale?: string,
  now = Date.now()
): InterviewSession {
  if (!session.finalAssessment || !rationale?.trim()) return session;
  const finalAssessment: DerivedFinalAssessment = {
    ...session.finalAssessment,
    rationale: rationale.trim(),
  };
  return {
    ...session,
    finalAssessment,
    updatedAt: now,
    derivedState: deriveInterviewState(session.evidenceLog, finalAssessment),
  };
}

export function buildFinalAssessmentSummary(
  session: InterviewSession
): DerivedFinalAssessment {
  return (
    session.finalAssessment ??
    finalizeInterviewSession(session).finalAssessment!
  );
}

export function parseFinalAssessmentToken(
  value: string
): InterviewScore | null {
  if (!value.startsWith(FINAL_ASSESSMENT_PREFIX)) return null;
  const raw = value.slice(FINAL_ASSESSMENT_PREFIX.length);
  try {
    return JSON.parse(raw) as InterviewScore;
  } catch {
    return null;
  }
}
