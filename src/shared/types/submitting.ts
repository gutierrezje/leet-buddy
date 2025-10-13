import { CurrentProblem } from './problems';

export type SubmissionStatus = 'Accepted' | 'Failed';

export interface SubmissionRecord {
  submissionId: string;
  at: number; // epoch ms
  elapsedSec?: number;
  source?: 'auto' | 'manual';
  problem: CurrentProblem;
}

export interface PathInfo {
  problemSlug: string;
  submissionId?: string;
}
