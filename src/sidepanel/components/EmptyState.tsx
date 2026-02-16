import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function EmptyState() {
  const handleRandomProblem = () => {
    window.open('https://leetcode.com/problemset/', '_blank');
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen p-8 text-center bg-background">
      <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-primary/10 mb-4">
        <span className="text-primary font-semibold text-lg font-mono">LB</span>
      </div>

      <h2 className="text-base font-semibold mb-1">Ready to Practice</h2>
      <p className="text-xs text-muted-foreground max-w-[240px] leading-relaxed mb-6">
        Navigate to a LeetCode problem to start your guided interview session.
      </p>

      <div className="w-full max-w-[200px] space-y-3 mb-6">
        <div className="flex items-start gap-2.5">
          <div className="w-1 h-1 rounded-full bg-primary mt-1.5 shrink-0" />
          <span className="text-xs text-muted-foreground text-left">
            Guided questions & hints
          </span>
        </div>
        <div className="flex items-start gap-2.5">
          <div className="w-1 h-1 rounded-full bg-primary mt-1.5 shrink-0" />
          <span className="text-xs text-muted-foreground text-left">
            Solve time tracking
          </span>
        </div>
        <div className="flex items-start gap-2.5">
          <div className="w-1 h-1 rounded-full bg-primary mt-1.5 shrink-0" />
          <span className="text-xs text-muted-foreground text-left">
            Topic coverage review
          </span>
        </div>
      </div>

      <Button
        onClick={handleRandomProblem}
        variant="outline"
        className="text-xs"
      >
        <ExternalLink className="h-3 w-3" />
        Browse Problems
      </Button>
    </div>
  );
}
