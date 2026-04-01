import type { Chat } from '@google/genai';
import type { GeminiModelKey } from '../../config';
import { createGemini25ToolRuntime } from './gemini25';
import { createNoToolRuntime } from './none';
import type {
  ChatToolRuntime,
  RuntimeResponse,
  RuntimeSendParams,
} from './types';

function isGemini25Model(modelId: string): boolean {
  return modelId.startsWith('gemini-2.5-');
}

export function createToolRuntime(params: {
  modelKey: GeminiModelKey;
  modelId: string;
  chat: Chat;
}): ChatToolRuntime {
  if (isGemini25Model(params.modelId)) {
    return createGemini25ToolRuntime(params.chat);
  }

  return createNoToolRuntime(
    async (sendParams: RuntimeSendParams): Promise<RuntimeResponse> => {
      const response = await params.chat.sendMessage({
        message: sendParams.message,
        config: sendParams.config,
      });
      return {
        text: response.text ?? '',
        toolCalls: [],
      };
    },
    `gemini-${params.modelKey}-no-tools`
  );
}

export type {
  ChatToolRuntime,
  RuntimeResponse,
  RuntimeSendParams,
  RuntimeToolCall,
  RuntimeToolResponse,
} from './types';
