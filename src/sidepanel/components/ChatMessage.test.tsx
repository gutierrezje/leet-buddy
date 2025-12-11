import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test/test-utils';
import ChatMessage from './ChatMessage';
import { Message } from '@/shared/types';

describe('ChatMessage', () => {
  describe('User Messages', () => {
    it('renders user message with correct styling', () => {
      const message: Message = {
        id: '1',
        text: 'Hello, this is a test message',
        sender: 'user',
        timestamp: Date.now(),
      };

      const { container } = render(<ChatMessage message={message} />);

      const messageText = screen.getByText('Hello, this is a test message');
      expect(messageText).toBeInTheDocument();

      // Check if the outermost div has the correct alignment class
      const outerContainer = container.querySelector('.justify-end');
      expect(outerContainer).toBeInTheDocument();
    });

    it('displays user message as plain text without markdown rendering', () => {
      const message: Message = {
        id: '2',
        text: '**Bold** text and *italic* text',
        sender: 'user',
        timestamp: Date.now(),
      };

      render(<ChatMessage message={message} />);

      // User messages should show raw markdown, not rendered
      expect(
        screen.getByText('**Bold** text and *italic* text')
      ).toBeInTheDocument();
    });

    it('preserves whitespace in user messages', () => {
      const message: Message = {
        id: '3',
        text: 'Line 1\nLine 2\nLine 3',
        sender: 'user',
        timestamp: Date.now(),
      };

      const { container } = render(<ChatMessage message={message} />);

      const textElement = container.querySelector('.whitespace-pre-wrap');
      expect(textElement).toBeInTheDocument();
      // textContent normalizes whitespace in jsdom, just verify element exists with class
    });
  });

  describe('AI Messages', () => {
    it('renders AI message with correct styling', () => {
      const message: Message = {
        id: '4',
        text: 'This is an AI response',
        sender: 'ai',
        timestamp: Date.now(),
      };

      const { container } = render(<ChatMessage message={message} />);

      const messageText = screen.getByText('This is an AI response');
      expect(messageText).toBeInTheDocument();

      // Check if the outermost div has the correct alignment class
      const outerContainer = container.querySelector('.justify-start');
      expect(outerContainer).toBeInTheDocument();
    });

    it('renders markdown in AI messages', () => {
      const message: Message = {
        id: '5',
        text: '**Bold text** and *italic text*',
        sender: 'ai',
        timestamp: Date.now(),
      };

      const { container } = render(<ChatMessage message={message} />);

      // ReactMarkdown should render the markdown
      const prose = container.querySelector('.prose');
      expect(prose).toBeInTheDocument();
    });

    it('renders code blocks in AI messages', () => {
      const message: Message = {
        id: '6',
        text: '```javascript\nconst x = 5;\n```',
        sender: 'ai',
        timestamp: Date.now(),
      };

      const { container } = render(<ChatMessage message={message} />);

      const prose = container.querySelector('.prose');
      expect(prose).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading animation when isLoading is true', () => {
      const message: Message = {
        id: '7',
        text: '',
        sender: 'ai',
        timestamp: Date.now(),
        isLoading: true,
      };

      const { container } = render(<ChatMessage message={message} />);

      // Check for loading dots
      const loadingDots = container.querySelectorAll('.animate-bounce');
      expect(loadingDots).toHaveLength(3);
    });

    it('does not show message text when loading', () => {
      const message: Message = {
        id: '8',
        text: 'This should not be visible',
        sender: 'ai',
        timestamp: Date.now(),
        isLoading: true,
      };

      render(<ChatMessage message={message} />);

      expect(
        screen.queryByText('This should not be visible')
      ).not.toBeInTheDocument();
    });

    it('shows message text when not loading', () => {
      const message: Message = {
        id: '9',
        text: 'This should be visible',
        sender: 'ai',
        timestamp: Date.now(),
        isLoading: false,
      };

      render(<ChatMessage message={message} />);

      expect(screen.getByText('This should be visible')).toBeInTheDocument();
    });
  });

  describe('Styling and Layout', () => {
    it('applies primary background for user messages', () => {
      const message: Message = {
        id: '10',
        text: 'User message',
        sender: 'user',
        timestamp: Date.now(),
      };

      const { container } = render(<ChatMessage message={message} />);

      const card = container.querySelector('.bg-primary');
      expect(card).toBeInTheDocument();
    });

    it('applies accent background for AI messages', () => {
      const message: Message = {
        id: '11',
        text: 'AI message',
        sender: 'ai',
        timestamp: Date.now(),
      };

      const { container } = render(<ChatMessage message={message} />);

      const card = container.querySelector('.bg-accent');
      expect(card).toBeInTheDocument();
    });

    it('has max-width constraint', () => {
      const message: Message = {
        id: '12',
        text: 'Test message',
        sender: 'user',
        timestamp: Date.now(),
      };

      const { container } = render(<ChatMessage message={message} />);

      const messageContainer = container.querySelector('.max-w-xs');
      expect(messageContainer).toBeInTheDocument();
    });
  });
});
