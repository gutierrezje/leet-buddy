export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: number;
  sender: MessageRole;
  text: string;
  timestamp: number;
  isLoading?: boolean;
}
