export type InterviewStage =
  | 'before_coding'
  | 'during_coding'
  | 'after_coding'
  | 'completed';

export type ChecklistStatus = 'pending' | 'partial' | 'done';

export type InterviewEvidenceSource = 'llm' | 'system' | 'ui' | 'code';

export type InterviewEvidenceKind =
  | 'problem_restatement'
  | 'constraints_discussed'
  | 'edge_cases_discussed'
  | 'approach_discussed'
  | 'multiple_approaches_discussed'
  | 'approach_selected'
  | 'approach_rejected'
  | 'complexity_time_discussed'
  | 'complexity_space_discussed'
  | 'go_ahead_given'
  | 'coding_started'
  | 'early_coding_violation'
  | 'think_aloud'
  | 'meaningful_naming'
  | 'clean_code'
  | 'edge_case_handling'
  | 'walkthrough_example'
  | 'manual_testing'
  | 'bug_identified'
  | 'bug_fixed'
  | 'optimization_discussed'
  | 'variation_discussed'
  | 'uncertainty_signal'
  | 'hint_required'
  | 'core_logic_correction'
  | 'submission_detected'
  | 'stage_transition';

export type InterviewEvidencePayloadValue =
  | string
  | number
  | boolean
  | string[];

export type InterviewEvidencePayload = Record<
  string,
  InterviewEvidencePayloadValue
>;

export type InterviewEvidenceEvent = {
  id: string;
  kind: InterviewEvidenceKind;
  stageHint?: Exclude<InterviewStage, 'completed'>;
  source: InterviewEvidenceSource;
  turnId: string;
  snippet: string;
  confidence: number;
  createdAt: number;
  payload?: InterviewEvidencePayload;
};

export type InterviewEvidenceInput = {
  kind: InterviewEvidenceKind;
  stageHint?: Exclude<InterviewStage, 'completed'>;
  source?: InterviewEvidenceSource;
  turnId?: string;
  snippet: string;
  confidence?: number;
  payload?: InterviewEvidencePayload;
};

export type InterviewChecklistItem = {
  id: string;
  stage: Exclude<InterviewStage, 'completed'>;
  label: string;
  status: ChecklistStatus;
  evidence: string[];
};

export type InterviewScore = {
  dsa: number;
  communication: number;
  coding: number;
  speed: number;
  testing: number;
  overall: number;
  recommendation:
    | 'Strong Hire'
    | 'Hire'
    | 'Weak Hire'
    | 'Weak Reject'
    | 'Reject'
    | 'Strong Reject';
};

export type DerivedInterviewState = {
  stage: InterviewStage;
  stageLabel: string;
  coverage: InterviewChecklistItem[];
  currentStageChecklist: InterviewChecklistItem[];
  missingAreas: string[];
  strengths: string[];
  recentEvidence: string[];
  acknowledgedAccomplishments: string[];
  nextFollowUp: string | null;
  approachSummary: {
    selected?: string;
    alternatives: string[];
  };
  complexityClaims: {
    time?: string;
    space?: string;
  };
  edgeCasesMentioned: string[];
  readyToAdvance: boolean;
  recommendedNextStage?: Exclude<InterviewStage, 'completed'>;
};

export type DerivedFinalAssessment = InterviewScore & {
  summaryToken: string;
  rationale?: string;
};

export type InterviewStateUpdate = {
  events?: InterviewEvidenceInput[];
  suggestedStage?: Exclude<InterviewStage, 'completed'>;
  stageReason?: string;
  finalRecommendation?: InterviewScore['recommendation'];
  finalRationale?: string;
};

export type InterviewSession = {
  version: 2;
  slug: string;
  evidenceLog: InterviewEvidenceEvent[];
  derivedState: DerivedInterviewState;
  finalAssessment?: DerivedFinalAssessment;
  baselineNonCommentFingerprint?: string;
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
  nextEventSeq: number;
};
