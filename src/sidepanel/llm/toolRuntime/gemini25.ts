import type { Chat, FunctionCall, Part } from '@google/genai';
import { extractResponseText } from './textExtract';
import type {
  ChatToolRuntime,
  RuntimeResponse,
  RuntimeSendParams,
  RuntimeToolCall,
  RuntimeToolResponse,
} from './types';

function toRuntimeToolCall(call: FunctionCall): RuntimeToolCall | null {
  if (!call.name) return null;
  return {
    id: call.id,
    name: call.name,
    args: (call.args as Record<string, unknown> | undefined) ?? {},
  };
}

export function createGemini25ToolRuntime(chat: Chat): ChatToolRuntime {
  async function toRuntimeResponse(
    response: Awaited<ReturnType<Chat['sendMessage']>>
  ): Promise<RuntimeResponse> {
    return {
      text: extractResponseText(response),
      toolCalls: (response.functionCalls ?? [])
        .map(toRuntimeToolCall)
        .filter((item): item is RuntimeToolCall => item !== null),
    };
  }

  return {
    provider: 'gemini-2.5',
    supportsTools: true,
    async send(params: RuntimeSendParams): Promise<RuntimeResponse> {
      const response = await chat.sendMessage({
        message: params.message,
        config: params.config,
      });
      return toRuntimeResponse(response);
    },
    async sendToolResponses(
      responses: RuntimeToolResponse[]
    ): Promise<RuntimeResponse> {
      const message: Part[] = responses.map((response) => ({
        functionResponse: {
          id: response.id,
          name: response.name,
          response: response.payload,
        },
      }));

      const modelResponse = await chat.sendMessage({ message });
      return toRuntimeResponse(modelResponse);
    },
  };
}
