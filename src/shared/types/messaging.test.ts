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
});
