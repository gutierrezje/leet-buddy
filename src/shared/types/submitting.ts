import { ProblemMeta } from './problems';

export type SubmissionStatus = 'Accepted' | 'Failed' | 'Manual';

export interface SubmissionRecord {
  submissionId: string;
  status: SubmissionStatus;
  at: number; // epoch ms
  elapsedSec?: number;
  source?: 'auto' | 'manual';
  meta?: ProblemMeta;
}

interface PathInfo {
  problemSlug: string;
  submissionId?: string;
}
