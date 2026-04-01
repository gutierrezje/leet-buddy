import type {
  ChatToolRuntime,
  RuntimeResponse,
  RuntimeSendParams,
  RuntimeToolResponse,
} from './types';

export function createNoToolRuntime(
  sender: (params: RuntimeSendParams) => Promise<RuntimeResponse>,
  provider = 'none'
): ChatToolRuntime {
  return {
    provider,
    supportsTools: false,
    send(params: RuntimeSendParams) {
      return sender(params);
    },
    async sendToolResponses(_responses: RuntimeToolResponse[]) {
      throw new Error('Tool responses are not supported by this runtime.');
    },
  };
}
