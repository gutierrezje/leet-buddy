import type { ProblemMeta } from './problems';
import type { SubmissionStatus } from './submitting';

export type MessageRole = 'user' | 'ai' | 'system';

export interface Message {
  id: string;
  sender: MessageRole;
  text: string;
  timestamp: number;
  isLoading?: boolean;
}

export interface HintPrompt {
  id: string;
  buttonText: string;
  messageText: string;
  displayText: string;
  icon: React.ComponentType<{ className?: string }>;
}

export type ProblemMetadataMessage = {
  type: 'PROBLEM_METADATA';
  slug: string;
} & ProblemMeta;

export type SubmissionResultMessage = {
  type: 'PROBLEM_SUBMISSION_RESULT';
  slug: string;
  submissionId: string;
  status: SubmissionStatus;
  at: number;
};

export type ProblemAcceptedMessage = {
  type: 'PROBLEM_ACCEPTED';
  slug: string;
  submissionId: string;
  at: number;
};

export type GetCurrentProblemRequest = { type: 'GET_CURRENT_PROBLEM' };
export type GetCurrentProblemResponse =
  | (ProblemMetadataMessage & { type?: never })
  | null;

export type RuntimeMessage =
  | ProblemMetadataMessage
  | SubmissionResultMessage
  | ProblemAcceptedMessage
  | GetCurrentProblemRequest;
