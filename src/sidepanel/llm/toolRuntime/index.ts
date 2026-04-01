import type { Chat, GoogleGenAI } from '@google/genai';
import type { GeminiModelKey } from '../../config';
import { createGemini3ToolRuntime } from './gemini3';
import { createGemini25ToolRuntime } from './gemini25';
import { createNoToolRuntime } from './none';
import { extractResponseText } from './textExtract';
import type {
  ChatToolRuntime,
  RuntimeResponse,
  RuntimeSendParams,
} from './types';

function isGemini25Model(modelId: string): boolean {
  return modelId.startsWith('gemini-2.5-');
}

function isGemini3Model(modelId: string): boolean {
  return modelId.startsWith('gemini-3-');
}

type ToolDeclarationLike = {
  name?: string;
  description?: string;
  parameters?: unknown;
  parametersJsonSchema?: unknown;
};

export function createToolRuntime(params: {
  modelKey: GeminiModelKey;
  modelId: string;
  chat: Chat;
  ai: GoogleGenAI;
  systemInstruction: string;
  toolDeclarations: ToolDeclarationLike[];
}): ChatToolRuntime {
  if (isGemini25Model(params.modelId)) {
    return createGemini25ToolRuntime(params.chat);
  }

  if (isGemini3Model(params.modelId)) {
    return createGemini3ToolRuntime({
      ai: params.ai,
      modelId: params.modelId,
      systemInstruction: params.systemInstruction,
      tools: params.toolDeclarations,
    });
  }

  return createNoToolRuntime(
    async (sendParams: RuntimeSendParams): Promise<RuntimeResponse> => {
      const response = await params.chat.sendMessage({
        message: sendParams.message,
        config: sendParams.config,
      });
      return {
        text: extractResponseText(response),
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
