import { Blocks, Gauge, LayoutTemplate, Lightbulb } from 'lucide-react';
import type { HintPrompt } from '@/shared/types';

export const GEMINI_MODELS = {
  '2.5-flash': {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: 'Lightning-fast with controllable thinking',
    supportsThinking: true,
    thinkingType: 'budget' as const,
  },
  '2.5-pro': {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    description: 'High-capability with adaptive thinking',
    supportsThinking: true,
    thinkingType: 'budget' as const,
  },
  '3-flash': {
    id: 'gemini-3-flash-preview',
    name: 'Gemini 3 Flash',
    description: 'Latest fast model',
    supportsThinking: true,
    thinkingType: 'level' as const,
  },
  '3-pro': {
    id: 'gemini-3-pro-preview',
    name: 'Gemini 3 Pro',
    description: 'State-of-the-art reasoning',
    supportsThinking: true,
    thinkingType: 'level' as const,
  },
} as const;

export type GeminiModelKey = keyof typeof GEMINI_MODELS;

// Thinking levels for Gemini 3 models
export const THINKING_LEVELS = {
  minimal: {
    id: 'minimal',
    name: 'Minimal',
    description: 'Fastest, likely no thinking',
  },
  low: {
    id: 'low',
    name: 'Low',
    description: 'Light reasoning',
  },
  medium: {
    id: 'medium',
    name: 'Medium',
    description: 'Balanced thinking',
  },
  high: {
    id: 'high',
    name: 'High',
    description: 'Deep reasoning (slower)',
  },
} as const;

export type ThinkingLevel = keyof typeof THINKING_LEVELS;

// Thinking budget presets for Gemini 2.5 models (0-32768 tokens)
export const THINKING_BUDGETS = {
  minimal: {
    value: 1024,
    name: 'Minimal',
    description: '~1k tokens (fastest)',
  },
  low: {
    value: 4096,
    name: 'Low',
    description: '~4k tokens',
  },
  medium: {
    value: 8192,
    name: 'Medium',
    description: '~8k tokens (balanced)',
  },
  high: {
    value: 16384,
    name: 'High',
    description: '~16k tokens (slower)',
  },
} as const;

export type ThinkingBudgetKey = keyof typeof THINKING_BUDGETS;

export const SYSTEM_PROMPT = `
You are an expert technical interviewer. Your goal is to help users solve programming problems by guiding them, not by giving them the answers.

Your single most important rule is: NEVER provide a direct answer, a complete algorithm, or write code for the user. Your entire purpose is to make the user think for themselves.

Follow these rules strictly:
1.  **Adopt the Interviewer Persona:** Maintain a professional, encouraging, and inquisitive tone.
2.  **Ask Guiding Questions:** Instead of giving information, ask questions that lead the user to the next step.
3.  **Start with Brute Force:** Always encourage the user to explain the simplest solution first.
4.  **Focus on Complexity:** Constantly ask about the time and space complexity of the user's proposed solution.
5.  **Provide Hints, Not Spoilers:** If a user is truly stuck, give them a small, high-level hint.
6.  **Handle Direct Requests for Answers:** If the user asks for the answer, politely refuse and steer them back to the problem-solving process.
`;

export const HINT_SYSTEM_PROMPT = `
You are a concise technical guide providing focused hints for programming problems.

Respond directly and briefly to the specific question asked. Do not add conversational filler, transitions, or redirect the user back to problem-solving. Just answer the question clearly and stop.

Keep your response to 2-3 sentences maximum unless the question requires more detail.
`;

export const HINT_PROMPTS: HintPrompt[] = [
  {
    id: '1',
    buttonText: 'DSA',
    displayText: 'Data structure / algorithm hint',
    messageText:
      'What are the primary data structures and/or algorithms used in the optimal solution? If there are multiple approaches, list them in order of efficiency.',
    icon: Blocks,
  },
  {
    id: '2',
    buttonText: 'Pattern',
    displayText: 'Pattern hint',
    messageText:
      'What algorithmic pattern(s) apply to this problem? (e.g., sliding window, two pointers, dynamic programming, etc.)',
    icon: LayoutTemplate,
  },
  {
    id: '3',
    buttonText: 'Complexity',
    displayText: 'Complexity hint',
    messageText:
      'What are the time and space complexity of the optimal solution(s)? If there are multiple approaches, list them.',
    icon: Gauge,
  },
  {
    id: '4',
    buttonText: 'Example',
    displayText: 'Example hint',
    messageText:
      'Provide a non-trivial example that illustrates the key insight of this problem.',
    icon: Lightbulb,
  },
];
