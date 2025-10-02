export type SubmissionStatus = 'Accepted' | 'Failed';

export interface SubmissionRecord {
  submissionId: string;
  status: SubmissionStatus;
  at: number; // epoch ms
}