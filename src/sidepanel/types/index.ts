export type MessageRole = 'user' | 'ai' | 'system';

export interface Message {
  id: string;
  sender: MessageRole;
  text: string;
  timestamp: number;
  isLoading?: boolean;
}
