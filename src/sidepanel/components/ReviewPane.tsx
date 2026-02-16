import { getAllSubmissions } from '@/shared/submissions';
import { SubmissionRecord, TopicStats } from '@/shared/types';
import { useEffect, useState } from 'react';
import { TopicsView } from './TopicHeatmap';
import { computeTopicStats } from '@/shared/utils/topicStats';
import { createLogger } from '@/shared/utils/debug';
import { cn } from '@/lib/utils';

const debug = createLogger('review-pane');

export default function ReviewPane() {
  const [submissions, setSubmissions] = useState<
    Record<string, SubmissionRecord>
  >({});
  const [categoryStats, setCategoryStats] = useState<
    Record<string, TopicStats>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    getAllSubmissions()
      .then((data) => {
        setSubmissions(data);
        const stats = computeTopicStats(Object.values(data));
        setCategoryStats(stats);
        setLoading(false);
      })
      .catch((err) => {
        debug('Error loading submissions: %O', err);
        setError('Failed to load submissions');
        setLoading(false);
      });

    const onStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area !== 'local') return;
      const touched = Object.keys(changes).filter((k) =>
        k.startsWith('submissions::')
      );
      if (touched.length > 0) {
        setLoading(true);
        setError(null);

        getAllSubmissions()
          .then((data) => {
            setSubmissions(data);
            const stats = computeTopicStats(Object.values(data));
            setCategoryStats(stats);
            setLoading(false);
          })
          .catch((err) => {
            debug('Error reloading submissions: %O', err);
            setError('Failed to reload submissions');
            setLoading(false);
          });
      }
    };

    chrome.storage.onChanged.addListener(onStorageChange);
    return () => chrome.storage.onChanged.removeListener(onStorageChange);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <div className="h-1 w-1 rounded-full bg-primary animate-bounce [animation-delay:-300ms]" />
          <div className="h-1 w-1 rounded-full bg-primary animate-bounce [animation-delay:-150ms]" />
          <div className="h-1 w-1 rounded-full bg-primary animate-bounce" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  const entries = Object.entries(submissions);
  debug('ReviewPane entries: %O', entries);

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center mb-3">
          <span className="text-muted-foreground text-lg">0</span>
        </div>
        <p className="text-sm text-muted-foreground">
          No submissions yet. Solve a problem to see your stats.
        </p>
      </div>
    );
  }

  const difficultyCounts: Record<string, number> = {
    Easy: 0,
    Medium: 0,
    Hard: 0,
  };
  for (const [_, rec] of entries) {
    const difficulty = rec.problem.difficulty;
    if (difficulty) {
      difficultyCounts[difficulty] = (difficultyCounts[difficulty] || 0) + 1;
    }
  }

  const total = entries.length;
  const maxDiff = Math.max(
    difficultyCounts.Easy,
    difficultyCounts.Medium,
    difficultyCounts.Hard,
    1
  );

  return (
    <div className="px-4 py-3 space-y-4">
      {/* Stats Overview */}
      <div>
        <span className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
          Overview
        </span>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {/* Total Solved */}
          <div className="rounded-lg bg-secondary/40 border border-border p-3">
            <div className="text-2xl font-semibold text-primary font-mono tabular-nums">
              {total}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Problems Solved
            </div>
          </div>

          {/* Difficulty Breakdown */}
          <div className="rounded-lg bg-secondary/40 border border-border p-3">
            <div className="text-xs text-muted-foreground mb-2">
              By Difficulty
            </div>
            <div className="space-y-1.5">
              {(['Easy', 'Medium', 'Hard'] as const).map((diff) => {
                const count = difficultyCounts[diff];
                const pct = (count / maxDiff) * 100;
                const colorMap = {
                  Easy: 'bg-difficulty-easy',
                  Medium: 'bg-difficulty-medium',
                  Hard: 'bg-difficulty-hard',
                };
                const textColorMap = {
                  Easy: 'text-difficulty-easy',
                  Medium: 'text-difficulty-medium',
                  Hard: 'text-difficulty-hard',
                };
                return (
                  <div key={diff} className="flex items-center gap-2">
                    <span
                      className={cn(
                        'text-xs font-medium w-5 shrink-0',
                        textColorMap[diff]
                      )}
                    >
                      {diff[0]}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-background overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', colorMap[diff])}
                        style={{
                          width: `${pct}%`,
                          transition: 'width 0.5s ease',
                        }}
                      />
                    </div>
                    <span className="text-xs font-mono text-muted-foreground w-4 text-right tabular-nums">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Topic Coverage */}
      <div>
        <span className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
          Topic Coverage
        </span>
        <div className="mt-2">
          <TopicsView categoryStats={categoryStats} />
        </div>
      </div>
    </div>
  );
}
