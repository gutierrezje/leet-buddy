import { COMPACT_TOPICS } from '@/shared/categoryMap';
import { TopicStats } from '@/shared/types';
import { cn } from '@/lib/utils';

type TopicsViewProps = {
  categoryStats: Record<string, TopicStats>;
};

export function TopicsView({ categoryStats }: TopicsViewProps) {
  const maxProblems = Math.max(
    ...Object.values(categoryStats).map((s) => s.totalProblems),
    1
  );

  return (
    <div className="space-y-1">
      {COMPACT_TOPICS.map((cat) => {
        const stats = categoryStats[cat];
        const hasData = stats && stats.totalProblems > 0;
        const coverage = hasData ? stats.totalProblems / maxProblems : 0;

        return (
          <div
            key={cat}
            className={cn(
              'group relative rounded-md px-3 py-2 transition-colors',
              hasData
                ? 'hover:bg-secondary/60'
                : 'opacity-35'
            )}
          >
            <div className="flex items-center justify-between mb-1">
              <span
                className={cn(
                  'text-xs font-medium truncate',
                  hasData ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {cat}
              </span>
              {hasData && (
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-xs font-mono text-muted-foreground tabular-nums">
                    {Math.floor(stats.avgTime / 60)}m avg
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-mono text-difficulty-easy tabular-nums">
                      {stats.difficulties.Easy}
                    </span>
                    <span className="text-xs text-muted-foreground/50">/</span>
                    <span className="text-xs font-mono text-difficulty-medium tabular-nums">
                      {stats.difficulties.Medium}
                    </span>
                    <span className="text-xs text-muted-foreground/50">/</span>
                    <span className="text-xs font-mono text-difficulty-hard tabular-nums">
                      {stats.difficulties.Hard}
                    </span>
                  </div>
                </div>
              )}
            </div>
            {/* Progress bar */}
            <div className="h-1 rounded-full bg-secondary/80 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary/70 transition-all duration-500"
                style={{ width: `${coverage * 100}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
