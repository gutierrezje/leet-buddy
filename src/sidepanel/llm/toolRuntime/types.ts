import type { Part } from '@google/genai';

export type RuntimeToolCall = {
  id?: string;
  name: string;
  args: Record<string, unknown>;
};

export type RuntimeToolResponse = {
  id?: string;
  name: string;
  payload: Record<string, unknown>;
};

export type RuntimeSendParams = {
  message: string | Part[];
  config?: Record<string, unknown>;
};

export type RuntimeResponse = {
  text: string;
  toolCalls: RuntimeToolCall[];
};

export interface ChatToolRuntime {
  readonly provider: string;
  readonly supportsTools: boolean;
  send(params: RuntimeSendParams): Promise<RuntimeResponse>;
  sendToolResponses(responses: RuntimeToolResponse[]): Promise<RuntimeResponse>;
}
