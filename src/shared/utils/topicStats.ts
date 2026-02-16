import type { SubmissionRecord, TopicStats } from '../types';

export function computeTopicStats(
  submissions: SubmissionRecord[]
): Record<string, TopicStats> {
  const stats: Record<string, TopicStats> = {};

  for (const [_, rec] of Object.entries(submissions)) {
    const { tags, difficulty } = rec.problem;
    const elapsedSec = rec.elapsedSec || 0;

    // Process each topic this problem belongs to
    for (const topic of tags) {
      if (!stats[topic]) {
        stats[topic] = {
          topic,
          totalProblems: 0,
          totalTime: 0,
          avgTime: 0,
          difficulties: { Easy: 0, Medium: 0, Hard: 0 },
        };
      }

      const stat = stats[topic];
      stat.totalProblems += 1;
      stat.totalTime += elapsedSec;

      if (
        difficulty === 'Easy' ||
        difficulty === 'Medium' ||
        difficulty === 'Hard'
      ) {
        stat.difficulties[difficulty] += 1;
      }
    }
  }

  for (const stat of Object.values(stats)) {
    stat.avgTime =
      stat.totalProblems > 0
        ? Math.round(stat.totalTime / stat.totalProblems)
        : 0;
  }

  return stats;
}
