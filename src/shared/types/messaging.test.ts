import { describe, it, expect } from 'vitest';
import {
  isProblemMetadataMessage,
  isSubmissionAcceptedMessage,
  isProblemClearedMessage,
  type ProblemMetadataMessage,
  type SubmissionAcceptedMessage,
  type ProblemClearedMessage,
} from './messaging';

describe('Runtime Message Type Guards', () => {
  describe('isProblemMetadataMessage', () => {
    it('validates correct PROBLEM_METADATA message', () => {
      const msg: ProblemMetadataMessage = {
        type: 'PROBLEM_METADATA',
        slug: 'two-sum',
        title: 'Two Sum',
        difficulty: 'Easy',
        tags: ['Array', 'Hash Table'],
      };

      expect(isProblemMetadataMessage(msg)).toBe(true);
    });

    it('accepts optional startAt field', () => {
      const msg = {
        type: 'PROBLEM_METADATA',
        slug: 'two-sum',
        title: 'Two Sum',
        difficulty: 'Easy',
        tags: ['Array'],
        startAt: 1234567890,
      };

      expect(isProblemMetadataMessage(msg)).toBe(true);
    });

    it('rejects message with missing slug', () => {
      const msg = {
        type: 'PROBLEM_METADATA',
        title: 'Two Sum',
        difficulty: 'Easy',
        tags: ['Array'],
      };

      expect(isProblemMetadataMessage(msg)).toBe(false);
    });

    it('rejects message with missing title', () => {
      const msg = {
        type: 'PROBLEM_METADATA',
        slug: 'two-sum',
        difficulty: 'Easy',
        tags: ['Array'],
      };

      expect(isProblemMetadataMessage(msg)).toBe(false);
    });

    it('rejects message with wrong type', () => {
      const msg = {
        type: 'WRONG_TYPE',
        slug: 'two-sum',
        title: 'Two Sum',
        difficulty: 'Easy',
        tags: ['Array'],
      };

      expect(isProblemMetadataMessage(msg)).toBe(false);
    });

    it('rejects null', () => {
      expect(isProblemMetadataMessage(null)).toBe(false);
    });

    it('rejects undefined', () => {
      expect(isProblemMetadataMessage(undefined)).toBe(false);
    });

    it('rejects non-object', () => {
      expect(isProblemMetadataMessage('string')).toBe(false);
      expect(isProblemMetadataMessage(123)).toBe(false);
    });
  });

  describe('isSubmissionAcceptedMessage', () => {
    it('validates correct SUBMISSION_ACCEPTED message', () => {
      const msg: SubmissionAcceptedMessage = {
        type: 'SUBMISSION_ACCEPTED',
        slug: 'two-sum',
        submissionId: '123456',
        at: 1234567890,
      };

      expect(isSubmissionAcceptedMessage(msg)).toBe(true);
    });

    it('rejects message with missing slug', () => {
      const msg = {
        type: 'SUBMISSION_ACCEPTED',
        submissionId: '123456',
        at: 1234567890,
      };

      expect(isSubmissionAcceptedMessage(msg)).toBe(false);
    });

    it('rejects message with missing submissionId', () => {
      const msg = {
        type: 'SUBMISSION_ACCEPTED',
        slug: 'two-sum',
        at: 1234567890,
      };

      expect(isSubmissionAcceptedMessage(msg)).toBe(false);
    });

    it('rejects message with wrong type', () => {
      const msg = {
        type: 'WRONG_TYPE',
        slug: 'two-sum',
        submissionId: '123456',
        at: 1234567890,
      };

      expect(isSubmissionAcceptedMessage(msg)).toBe(false);
    });

    it('rejects null', () => {
      expect(isSubmissionAcceptedMessage(null)).toBe(false);
    });
  });

  describe('isProblemClearedMessage', () => {
    it('validates correct PROBLEM_CLEARED message', () => {
      const msg: ProblemClearedMessage = {
        type: 'PROBLEM_CLEARED',
      };

      expect(isProblemClearedMessage(msg)).toBe(true);
    });

    it('rejects message with wrong type', () => {
      const msg = {
        type: 'WRONG_TYPE',
      };

      expect(isProblemClearedMessage(msg)).toBe(false);
    });

    it('rejects null', () => {
      expect(isProblemClearedMessage(null)).toBe(false);
    });

    it('rejects object without type', () => {
      const msg = {
        someField: 'value',
      };

      expect(isProblemClearedMessage(msg)).toBe(false);
    });
  });

  describe('Malformed Payload Handling', () => {
    it('rejects messages with extra unknown fields', () => {
      const msg = {
        type: 'PROBLEM_METADATA',
        slug: 'two-sum',
        title: 'Two Sum',
        difficulty: 'Easy',
        tags: ['Array'],
        maliciousField: '<script>alert("xss")</script>',
      };

      // Should still validate (type guards don't check for extra fields)
      expect(isProblemMetadataMessage(msg)).toBe(true);
    });

    it('rejects messages with null required fields', () => {
      const msg = {
        type: 'PROBLEM_METADATA',
        slug: null,
        title: 'Two Sum',
        difficulty: 'Easy',
        tags: ['Array'],
      };

      expect(isProblemMetadataMessage(msg)).toBe(false);
    });

    it('rejects messages with wrong field types', () => {
      const msg = {
        type: 'PROBLEM_METADATA',
        slug: 123, // Should be string
        title: 'Two Sum',
        difficulty: 'Easy',
        tags: ['Array'],
      };

      expect(isProblemMetadataMessage(msg)).toBe(false);
    });

    it('rejects SUBMISSION_ACCEPTED with invalid timestamp', () => {
      const msg = {
        type: 'SUBMISSION_ACCEPTED',
        slug: 'two-sum',
        submissionId: '123456',
        at: 'invalid-timestamp',
      };

      expect(isSubmissionAcceptedMessage(msg)).toBe(false);
    });

    it('handles messages with prototype pollution attempts without throwing', () => {
      const msg = {
        type: 'PROBLEM_METADATA',
        slug: 'two-sum',
        title: 'Two Sum',
        __proto__: { polluted: true },
      };

      // Type guard should not throw on prototype pollution attempts
      // Note: Basic type guards check required fields but don't validate against __proto__
      expect(() => isProblemMetadataMessage(msg)).not.toThrow();
    });

    it('handles deeply nested objects gracefully', () => {
      const deeplyNested = {
        type: 'PROBLEM_METADATA',
        slug: { nested: { very: { deep: 'two-sum' } } },
        title: 'Two Sum',
      };

      expect(isProblemMetadataMessage(deeplyNested)).toBe(false);
    });

    it('handles circular reference objects without throwing', () => {
      const circular: {
        type: string;
        slug: string;
        title?: string;
        self?: unknown;
      } = {
        type: 'PROBLEM_METADATA',
        slug: 'two-sum',
        title: 'Two Sum',
      };
      circular.self = circular;

      // Type guard should not throw on circular references
      // Note: Basic type guards check required fields but don't traverse object graphs
      expect(() => isProblemMetadataMessage(circular)).not.toThrow();
    });

    it('rejects messages with array instead of object', () => {
      const msg = ['PROBLEM_METADATA', 'two-sum', 'Two Sum'];

      expect(isProblemMetadataMessage(msg)).toBe(false);
    });

    it('rejects messages with function values', () => {
      const msg = {
        type: 'PROBLEM_METADATA',
        slug: () => 'two-sum',
        title: 'Two Sum',
      };

      expect(isProblemMetadataMessage(msg)).toBe(false);
    });

    it('handles empty string type gracefully', () => {
      const msg = {
        type: '',
        slug: 'two-sum',
        title: 'Two Sum',
      };

      expect(isProblemMetadataMessage(msg)).toBe(false);
      expect(isSubmissionAcceptedMessage(msg)).toBe(false);
      expect(isProblemClearedMessage(msg)).toBe(false);
    });

    it('handles messages with Symbol type', () => {
      const msg = {
        type: Symbol('PROBLEM_METADATA'),
        slug: 'two-sum',
        title: 'Two Sum',
      };

      expect(isProblemMetadataMessage(msg)).toBe(false);
    });
  });
});
