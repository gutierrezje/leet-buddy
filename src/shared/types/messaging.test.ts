import { describe, it, expect } from 'vitest';
import {
  isProblemMetadataMessage,
  isSubmissionAcceptedMessage,
  isProblemClearedMessage,
  isGetCurrentProblemRequest,
  isRuntimeMessage,
  type ProblemMetadataMessage,
  type SubmissionAcceptedMessage,
  type ProblemClearedMessage,
  type GetCurrentProblemRequest,
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

  describe('isGetCurrentProblemRequest', () => {
    it('validates correct GET_CURRENT_PROBLEM message', () => {
      const msg: GetCurrentProblemRequest = {
        type: 'GET_CURRENT_PROBLEM',
      };

      expect(isGetCurrentProblemRequest(msg)).toBe(true);
    });

    it('rejects message with wrong type', () => {
      const msg = {
        type: 'WRONG_TYPE',
      };

      expect(isGetCurrentProblemRequest(msg)).toBe(false);
    });

    it('rejects null', () => {
      expect(isGetCurrentProblemRequest(null)).toBe(false);
    });
  });

  describe('isRuntimeMessage', () => {
    it('accepts PROBLEM_METADATA message', () => {
      const msg: ProblemMetadataMessage = {
        type: 'PROBLEM_METADATA',
        slug: 'two-sum',
        title: 'Two Sum',
        difficulty: 'Easy',
        tags: ['Array'],
      };

      expect(isRuntimeMessage(msg)).toBe(true);
    });

    it('accepts SUBMISSION_ACCEPTED message', () => {
      const msg: SubmissionAcceptedMessage = {
        type: 'SUBMISSION_ACCEPTED',
        slug: 'two-sum',
        submissionId: '123456',
        at: 1234567890,
      };

      expect(isRuntimeMessage(msg)).toBe(true);
    });

    it('accepts PROBLEM_CLEARED message', () => {
      const msg: ProblemClearedMessage = {
        type: 'PROBLEM_CLEARED',
      };

      expect(isRuntimeMessage(msg)).toBe(true);
    });

    it('accepts GET_CURRENT_PROBLEM message', () => {
      const msg: GetCurrentProblemRequest = {
        type: 'GET_CURRENT_PROBLEM',
      };

      expect(isRuntimeMessage(msg)).toBe(true);
    });

    it('rejects unknown message type', () => {
      const msg = {
        type: 'UNKNOWN_TYPE',
        data: 'something',
      };

      expect(isRuntimeMessage(msg)).toBe(false);
    });

    it('rejects invalid messages', () => {
      expect(isRuntimeMessage(null)).toBe(false);
      expect(isRuntimeMessage(undefined)).toBe(false);
      expect(isRuntimeMessage('string')).toBe(false);
      expect(isRuntimeMessage({})).toBe(false);
    });
  });
});
