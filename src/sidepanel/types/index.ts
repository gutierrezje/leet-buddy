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
