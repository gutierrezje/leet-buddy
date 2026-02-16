export type MessageRole = 'user' | 'ai' | 'system';

export interface Message {
  id: string;
  sender: MessageRole;
  text: string;
  timestamp: number;
  isLoading?: boolean;
  isHint?: boolean;
}

export interface HintPrompt {
  id: string;
  buttonText: string;
  messageText: string;
  displayText: string;
  icon: React.ComponentType<{ className?: string }>;
}

// Canonical message types for content script <-> sidepanel communication

export type ProblemMetadataMessage = {
  type: 'PROBLEM_METADATA';
  slug: string;
  title: string;
  difficulty: string;
  tags: string[];
  startAt?: number;
};

export type SubmissionAcceptedMessage = {
  type: 'SUBMISSION_ACCEPTED';
  slug: string;
  submissionId: string;
  at: number;
};

export type ProblemClearedMessage = {
  type: 'PROBLEM_CLEARED';
};

// Union of all runtime messages
export type RuntimeMessage =
  | ProblemMetadataMessage
  | SubmissionAcceptedMessage
  | ProblemClearedMessage;

// Type guards for runtime message validation

export function isProblemMetadataMessage(
  msg: unknown
): msg is ProblemMetadataMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'type' in msg &&
    msg.type === 'PROBLEM_METADATA' &&
    'slug' in msg &&
    typeof msg.slug === 'string' &&
    'title' in msg &&
    typeof msg.title === 'string'
  );
}

export function isSubmissionAcceptedMessage(
  msg: unknown
): msg is SubmissionAcceptedMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'type' in msg &&
    msg.type === 'SUBMISSION_ACCEPTED' &&
    'slug' in msg &&
    typeof msg.slug === 'string' &&
    'submissionId' in msg &&
    typeof msg.submissionId === 'string' &&
    'at' in msg &&
    typeof msg.at === 'number'
  );
}

export function isProblemClearedMessage(
  msg: unknown
): msg is ProblemClearedMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'type' in msg &&
    msg.type === 'PROBLEM_CLEARED'
  );
}
