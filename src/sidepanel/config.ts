import { Blocks, Gauge, LayoutTemplate, Lightbulb } from 'lucide-react';
import type { HintPrompt } from '@/shared/types';

export const GEMINI_MODEL = 'gemini-2.5-flash';

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
