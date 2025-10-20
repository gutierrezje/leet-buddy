import { COMPACT_TOPICS } from '@/shared/categoryMap';
import { Card } from '@/components/ui/card';
import { TopicStats } from '@/shared/types';
import { cn } from '@/lib/utils';

type TopicsViewProps = {
  categoryStats: Record<string, TopicStats>;
};

export function TopicsView({ categoryStats }: TopicsViewProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {COMPACT_TOPICS.map((cat) => {
        const stats = categoryStats[cat];
        const hasData = stats && stats.totalProblems > 0;
        return (
          <Card
            key={cat}
            className={cn('p-4', hasData ? 'border-primary/50' : 'opacity-50')}
          >
            <div className={cn('font-semibold')}>{cat}</div>
            {hasData && (
              <div>
                <div>{`Avg time: `}
                  <span className="text-primary">{`${Math.floor(stats.avgTime / 60)}m`}</span>
                </div>
                <div className="flex flex-row items-center justify-start gap-2">
                  Solved: 
                  <span className="text-difficulty-easy ">
                    {stats.difficulties.Easy}
                  </span>
                  <span className="text-difficulty-medium">
                    {stats.difficulties.Medium}
                  </span>
                  <span className="text-difficulty-hard">
                    {stats.difficulties.Hard}
                  </span>
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
