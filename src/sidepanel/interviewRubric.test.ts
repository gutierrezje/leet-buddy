import { describe, expect, it } from 'vitest';
import {
  advanceInterviewStage,
  createInterviewSession,
  finalizeInterviewSession,
  recordInterviewEvidence,
} from './interviewRubric';

function createReadyForCodingSession() {
  return recordInterviewEvidence(createInterviewSession('two-sum'), [
    {
      kind: 'problem_restatement',
      source: 'ui',
      snippet: 'Candidate restated the problem.',
    },
    {
      kind: 'constraints_discussed',
      source: 'ui',
      snippet: 'Candidate asked about input bounds.',
    },
    {
      kind: 'edge_cases_discussed',
      source: 'ui',
      snippet: 'Candidate covered empty input.',
      payload: { edgeCases: ['empty input'] },
    },
    {
      kind: 'approach_discussed',
      source: 'ui',
      snippet: 'Candidate described brute force.',
      payload: { approach: 'Brute force' },
    },
    {
      kind: 'approach_discussed',
      source: 'ui',
      snippet: 'Candidate described hash map.',
      payload: { approach: 'Hash map' },
    },
    {
      kind: 'multiple_approaches_discussed',
      source: 'ui',
      snippet: 'Candidate compared two approaches.',
    },
    {
      kind: 'complexity_time_discussed',
      source: 'ui',
      snippet: 'Candidate said time is O(n).',
      payload: { value: 'O(n)' },
    },
    {
      kind: 'complexity_space_discussed',
      source: 'ui',
      snippet: 'Candidate said space is O(n).',
      payload: { value: 'O(n)' },
    },
  ]);
}

function createStrongSession() {
  let session = createReadyForCodingSession();
  session = advanceInterviewStage(
    session,
    'during_coding',
    'ui',
    'Ready to start coding.'
  );
  session = recordInterviewEvidence(session, [
    {
      kind: 'think_aloud',
      source: 'ui',
      snippet: 'Candidate narrated the implementation.',
    },
    {
      kind: 'meaningful_naming',
      source: 'ui',
      snippet: 'Candidate used descriptive names.',
    },
    {
      kind: 'clean_code',
      source: 'ui',
      snippet: 'Candidate kept the implementation clean.',
    },
    {
      kind: 'edge_case_handling',
      source: 'ui',
      snippet: 'Candidate handled duplicate values.',
    },
  ]);
  session = advanceInterviewStage(
    session,
    'after_coding',
    'ui',
    'Ready to review.'
  );
  return recordInterviewEvidence(session, [
    {
      kind: 'walkthrough_example',
      source: 'ui',
      snippet: 'Candidate walked through a sample input.',
    },
    {
      kind: 'manual_testing',
      source: 'ui',
      snippet: 'Candidate manually tested edge cases.',
    },
    {
      kind: 'bug_identified',
      source: 'ui',
      snippet: 'Candidate spotted an off-by-one issue.',
    },
    {
      kind: 'bug_fixed',
      source: 'ui',
      snippet: 'Candidate fixed the loop bound.',
    },
    {
      kind: 'optimization_discussed',
      source: 'ui',
      snippet: 'Candidate discussed memory tradeoffs.',
    },
  ]);
}

describe('interviewRubric evidence pipeline', () => {
  it('derives partial coverage when only one facet is present', () => {
    const session = recordInterviewEvidence(createInterviewSession('two-sum'), [
      {
        kind: 'constraints_discussed',
        source: 'ui',
        snippet: 'Candidate asked about input bounds.',
      },
    ]);

    expect(session.derivedState.stage).toBe('before_coding');
    expect(
      session.derivedState.coverage.find(
        (item) => item.id === 'before_constraints'
      )?.status
    ).toBe('partial');
    expect(session.derivedState.missingAreas).toContain(
      'Asked about constraints and edge cases'
    );
  });

  it('records early coding as a during-coding transition without granting go-ahead credit', () => {
    const session = recordInterviewEvidence(createInterviewSession('two-sum'), [
      {
        kind: 'coding_started',
        source: 'code',
        snippet:
          'Candidate changed code before the interviewer approved coding.',
      },
      {
        kind: 'early_coding_violation',
        source: 'system',
        snippet: 'Coding started before GO-AHEAD.',
      },
    ]);

    expect(session.derivedState.stage).toBe('during_coding');
    expect(
      session.derivedState.coverage.find(
        (item) => item.id === 'before_go_ahead'
      )?.status
    ).toBe('pending');
  });

  it('rejects stage advancement until the current stage is covered', () => {
    const initial = createInterviewSession('two-sum');
    const advanced = advanceInterviewStage(
      initial,
      'during_coding',
      'ui',
      'Attempting to advance too early.'
    );

    expect(advanced).toBe(initial);
    expect(advanced.derivedState.stage).toBe('before_coding');
  });

  it('bounds final recommendations to the deterministic score band', () => {
    const strongSession = createStrongSession();
    const completed = finalizeInterviewSession(strongSession, 'Strong Reject');

    expect(completed.derivedState.stage).toBe('completed');
    expect(completed.finalAssessment?.recommendation).toBe('Strong Hire');
    expect(completed.finalAssessment?.summaryToken).toContain(
      'FINAL_ASSESSMENT::'
    );
  });

  it('caps recommendation when core logic needed correction and hints', () => {
    const session = recordInterviewEvidence(createStrongSession(), [
      {
        kind: 'hint_required',
        source: 'llm',
        snippet: 'Interviewer gave a hint to unblock recurrence choice.',
      },
      {
        kind: 'core_logic_correction',
        source: 'llm',
        snippet: 'Interviewer corrected incorrect subtree merge logic.',
      },
    ]);

    const completed = finalizeInterviewSession(session);
    expect(completed.finalAssessment?.recommendation).toBe('Weak Hire');
  });

  it('downgrades heavily rescued interviews to weak reject at most', () => {
    const session = recordInterviewEvidence(createStrongSession(), [
      {
        kind: 'hint_required',
        source: 'llm',
        snippet: 'Hint 1: guided candidate through base case.',
      },
      {
        kind: 'hint_required',
        source: 'llm',
        snippet: 'Hint 2: guided candidate through recurrence.',
      },
      {
        kind: 'hint_required',
        source: 'llm',
        snippet: 'Hint 3: guided candidate through complexity rationale.',
      },
      {
        kind: 'core_logic_correction',
        source: 'llm',
        snippet: 'Corrected core algorithm structure.',
      },
      {
        kind: 'core_logic_correction',
        source: 'llm',
        snippet: 'Corrected incorrect return composition.',
      },
    ]);

    const completed = finalizeInterviewSession(session);
    expect(completed.finalAssessment?.recommendation).toBe('Weak Reject');
  });

  it('accepts a what-if variation as post-coding follow-up evidence', () => {
    let session = createReadyForCodingSession();
    session = advanceInterviewStage(
      session,
      'during_coding',
      'ui',
      'Ready to start coding.'
    );
    session = recordInterviewEvidence(session, [
      {
        kind: 'think_aloud',
        source: 'ui',
        snippet: 'Candidate narrated the implementation.',
      },
      {
        kind: 'meaningful_naming',
        source: 'ui',
        snippet: 'Candidate used descriptive names.',
      },
      {
        kind: 'clean_code',
        source: 'ui',
        snippet: 'Candidate kept the implementation clean.',
      },
      {
        kind: 'edge_case_handling',
        source: 'ui',
        snippet: 'Candidate handled duplicate values.',
      },
    ]);
    session = advanceInterviewStage(
      session,
      'after_coding',
      'ui',
      'Reviewing.'
    );
    session = recordInterviewEvidence(session, [
      {
        kind: 'walkthrough_example',
        source: 'ui',
        snippet: 'Candidate walked through a sample input.',
      },
      {
        kind: 'manual_testing',
        source: 'ui',
        snippet: 'Candidate manually tested edge cases.',
      },
      {
        kind: 'bug_identified',
        source: 'ui',
        snippet: 'Candidate spotted an off-by-one issue.',
      },
      {
        kind: 'bug_fixed',
        source: 'ui',
        snippet: 'Candidate fixed the loop bound.',
      },
    ]);

    expect(
      session.derivedState.coverage.find(
        (item) => item.id === 'after_optimizations'
      )?.status
    ).toBe('pending');

    session = recordInterviewEvidence(session, [
      {
        kind: 'variation_discussed',
        source: 'ui',
        snippet: 'Candidate discussed a streaming-input variation.',
      },
    ]);

    expect(
      session.derivedState.coverage.find(
        (item) => item.id === 'after_optimizations'
      )?.status
    ).toBe('done');
  });
});
