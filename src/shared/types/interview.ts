export type InterviewStage =
  | 'before_coding'
  | 'during_coding'
  | 'after_coding'
  | 'completed';

export type ChecklistStatus = 'pending' | 'partial' | 'done';

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

export type InterviewDirectiveUpdate = {
  itemId: string;
  status: ChecklistStatus;
  evidence?: string;
};

export type InterviewDirective = {
  updates: InterviewDirectiveUpdate[];
  action?: 'none' | 'advance' | 'complete';
};

export type InterviewStateUpdate = {
  stage: InterviewStage;
  checklist: InterviewDirectiveUpdate[];
  score?: InterviewScore;
};

export type InterviewSession = {
  slug: string;
  stage: InterviewStage;
  checklist: InterviewChecklistItem[];
  goAheadViolated?: boolean;
  baselineNonCommentFingerprint?: string;
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
  score?: InterviewScore;
};
