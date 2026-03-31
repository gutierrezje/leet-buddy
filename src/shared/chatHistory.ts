const CHAT_HISTORY_PREFIX = 'chatHistory::';
export const CHAT_HISTORY_INDEX_KEY = 'chatHistoryIndex';
export const MAX_CHAT_HISTORY_PROBLEMS = 100;
export const MAX_MESSAGES_PER_PROBLEM = 50;

export function getChatHistoryKey(problemSlug: string): string {
  return `${CHAT_HISTORY_PREFIX}${problemSlug}`;
}
