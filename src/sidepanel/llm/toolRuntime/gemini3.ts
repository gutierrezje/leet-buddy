import type { GoogleGenAI } from '@google/genai';
import type {
  ChatToolRuntime,
  RuntimeResponse,
  RuntimeSendParams,
  RuntimeToolCall,
  RuntimeToolResponse,
} from './types';

type ToolDeclarationLike = {
  name?: string;
  description?: string;
  parameters?: unknown;
  parametersJsonSchema?: unknown;
};

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') return {};
  return value as Record<string, unknown>;
}

function toTextInput(message: string | unknown[]): string {
  if (typeof message === 'string') return message;
  return message
    .map((part) => asObject(part).text)
    .filter((value): value is string => typeof value === 'string')
    .join('\n');
}

function toInteractionsTools(declarations: ToolDeclarationLike[]) {
  return declarations
    .filter((tool) => Boolean(tool.name))
    .map((tool) => ({
      type: 'function' as const,
      name: tool.name,
      description: tool.description,
      parameters: tool.parametersJsonSchema ?? tool.parameters,
    }));
}

function parseInteractionResponse(interaction: unknown): RuntimeResponse {
  const payload = asObject(interaction);
  const outputs = Array.isArray(payload.outputs) ? payload.outputs : [];

  const text = outputs
    .filter((item) => asObject(item).type === 'text')
    .map((item) => asObject(item).text)
    .filter((value): value is string => typeof value === 'string')
    .join('');

  const toolCalls = outputs
    .filter((item) => asObject(item).type === 'function_call')
    .map((item): RuntimeToolCall | null => {
      const content = asObject(item);
      const name = content.name;
      if (typeof name !== 'string') return null;
      return {
        id: typeof content.id === 'string' ? content.id : undefined,
        name,
        args: asObject(content.arguments),
      };
    })
    .filter((item): item is RuntimeToolCall => item !== null);

  return { text, toolCalls };
}

export function createGemini3ToolRuntime(params: {
  ai: GoogleGenAI;
  modelId: string;
  systemInstruction: string;
  tools: ToolDeclarationLike[];
}): ChatToolRuntime {
  let previousInteractionId: string | undefined;

  return {
    provider: 'gemini-3-interactions',
    supportsTools: true,
    async send(sendParams: RuntimeSendParams): Promise<RuntimeResponse> {
      const interaction = await params.ai.interactions.create({
        model: params.modelId,
        input: toTextInput(sendParams.message as string | unknown[]),
        previous_interaction_id: previousInteractionId,
        system_instruction: params.systemInstruction,
        tools: toInteractionsTools(params.tools),
      });

      const id = asObject(interaction).id;
      if (typeof id === 'string') {
        previousInteractionId = id;
      }

      return parseInteractionResponse(interaction);
    },
    async sendToolResponses(
      responses: RuntimeToolResponse[]
    ): Promise<RuntimeResponse> {
      const input = responses.map((response) => ({
        type: 'function_result' as const,
        call_id: response.id ?? `${response.name}-${Date.now()}`,
        name: response.name,
        result: response.payload,
        is_error: Boolean(response.payload.error),
      }));

      const interaction = await params.ai.interactions.create({
        model: params.modelId,
        input,
        previous_interaction_id: previousInteractionId,
        system_instruction: params.systemInstruction,
        tools: toInteractionsTools(params.tools),
      });

      const id = asObject(interaction).id;
      if (typeof id === 'string') {
        previousInteractionId = id;
      }

      return parseInteractionResponse(interaction);
    },
  };
}
