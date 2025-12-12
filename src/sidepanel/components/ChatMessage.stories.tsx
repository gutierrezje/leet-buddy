import type { Meta, StoryObj } from '@storybook/react-vite';
import ChatMessage from './ChatMessage';

const meta = {
  title: 'Sidepanel/ChatMessage',
  component: ChatMessage,
  parameters: {
    layout: 'padded',
  },
  argTypes: {
    message: {
      description: 'The message object to display',
    },
  },
} satisfies Meta<typeof ChatMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

// User message
export const UserMessage: Story = {
  args: {
    message: {
      id: '1',
      text: 'Hello! Can you help me solve this two-sum problem?',
      sender: 'user',
      timestamp: Date.now(),
    },
  },
};

// AI message with plain text
export const AIMessagePlain: Story = {
  args: {
    message: {
      id: '2',
      text: "Of course! Let's start by thinking about the problem step by step.",
      sender: 'ai',
      timestamp: Date.now(),
    },
  },
};

// AI message with markdown
export const AIMessageWithMarkdown: Story = {
  args: {
    message: {
      id: '3',
      text: `Great question! Here are some key points to consider:

**Time Complexity:**
- Brute force: O(n²)
- Hash map approach: O(n)

*Try thinking about how a hash map could help!*`,
      sender: 'ai',
      timestamp: Date.now(),
    },
  },
};

// AI message with code
export const AIMessageWithCode: Story = {
  args: {
    message: {
      id: '4',
      text: `Here's a hint on the approach:

\`\`\`javascript
function twoSum(nums, target) {
  const map = new Map();
  // What should we store in the map?
  // What should we check for?
}
\`\`\`

Think about what data structure would help us find complements efficiently.`,
      sender: 'ai',
      timestamp: Date.now(),
    },
  },
};

// Loading state
export const LoadingMessage: Story = {
  args: {
    message: {
      id: '5',
      text: '',
      sender: 'ai',
      timestamp: Date.now(),
      isLoading: true,
    },
  },
};

// Long user message
export const LongUserMessage: Story = {
  args: {
    message: {
      id: '6',
      text: `I'm trying to solve this problem but I'm stuck. I've tried using a nested loop to check every pair of numbers, but it's timing out on large inputs. How can I make it faster? I know there must be a better approach but I can't figure it out.`,
      sender: 'user',
      timestamp: Date.now(),
    },
  },
};

// Message with list
export const AIMessageWithList: Story = {
  args: {
    message: {
      id: '7',
      text: `Let's break down the solution:

1. Create a hash map to store numbers we've seen
2. For each number, check if its complement exists
3. If found, return the indices
4. Otherwise, add the current number to the map

Does this approach make sense?`,
      sender: 'ai',
      timestamp: Date.now(),
    },
  },
};

// Multiple messages conversation (using decorators)
export const Conversation: Story = {
  args: {
    message: {
      id: '1',
      text: 'Placeholder',
      sender: 'user',
      timestamp: Date.now(),
    },
  },
  render: () => (
    <div className="space-y-2 max-w-2xl">
      <ChatMessage
        message={{
          id: '1',
          text: 'Can you help me with the two-sum problem?',
          sender: 'user',
          timestamp: Date.now() - 60000,
        }}
      />
      <ChatMessage
        message={{
          id: '2',
          text: 'Of course! What approach are you considering?',
          sender: 'ai',
          timestamp: Date.now() - 50000,
        }}
      />
      <ChatMessage
        message={{
          id: '3',
          text: 'I was thinking about using two nested loops',
          sender: 'user',
          timestamp: Date.now() - 40000,
        }}
      />
      <ChatMessage
        message={{
          id: '4',
          text: `That's a good start! But can you think of a way to do it in **O(n)** time using a hash map?`,
          sender: 'ai',
          timestamp: Date.now() - 30000,
        }}
      />
      <ChatMessage
        message={{
          id: '5',
          text: '',
          sender: 'ai',
          timestamp: Date.now(),
          isLoading: true,
        }}
      />
    </div>
  ),
};

// Code overflow tests
export const CodeOverflowTests: Story = {
  args: {
    message: {
      id: '8',
      text: `Here are different overflow scenarios:

**Long single line:**
\`\`\`javascript
const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30];
const url = "https://api.example.com/v1/users/12345/profile/settings/preferences/notifications/email/subscriptions/updates";
\`\`\`

**Inline code:** Try using \`thisIsAVeryLongFunctionNameThatMightCauseOverflowIssuesInInlineCodeBlocks()\` here.`,
      sender: 'ai',
      timestamp: Date.now(),
    },
  },
};
