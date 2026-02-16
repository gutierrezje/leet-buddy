import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

import { CurrentProblem } from '@/shared/types';
import { formatHMS } from '@/shared/utils/time';
import { cn } from '@/lib/utils';

function TimeWheel({
  value,
  onChange,
  max,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  max?: number;
  label: string;
}) {
  const increment = () => {
    const next = value + 1;
    onChange(max !== undefined ? (next > max ? 0 : next) : next);
  };
  const decrement = () => {
    const next = value - 1;
    onChange(next < 0 ? (max ?? 0) : next);
  };
  const pad = (n: number) => n.toString().padStart(2, '0');

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={increment}
        className="p-0.5 rounded text-muted-foreground hover:text-primary transition-colors"
      >
        <ChevronUp className="h-4 w-4" />
      </button>
      <div className="w-12 h-10 rounded-md bg-secondary border border-border flex items-center justify-center">
        <span className="text-base font-mono tabular-nums text-foreground">
          {pad(value)}
        </span>
      </div>
      <button
        type="button"
        onClick={decrement}
        className="p-0.5 rounded text-muted-foreground hover:text-primary transition-colors"
      >
        <ChevronDown className="h-4 w-4" />
      </button>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

const difficultyColors: Record<string, string> = {
  Easy: 'text-difficulty-easy',
  Medium: 'text-difficulty-medium',
  Hard: 'text-difficulty-hard',
};

const difficultyDots: Record<string, string> = {
  Easy: 'bg-difficulty-easy',
  Medium: 'bg-difficulty-medium',
  Hard: 'bg-difficulty-hard',
};

type SaveModalProps = {
  open: boolean;
  onConfirm: (elapsedSec: number) => void;
  onCancel: () => void;
  problem: CurrentProblem;
  elapsedSec: number;
  previousTime?: number;
};

export default function SaveModal({
  open,
  onConfirm,
  onCancel,
  problem,
  elapsedSec,
  previousTime,
}: SaveModalProps) {
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (open) {
      const h = Math.floor(elapsedSec / 3600);
      const m = Math.floor((elapsedSec % 3600) / 60);
      const s = elapsedSec % 60;
      setHours(h);
      setMinutes(m);
      setSeconds(s);
    }
  }, [open, elapsedSec]);

  const handleConfirm = () => {
    const totalSec = hours * 3600 + minutes * 60 + seconds;
    onConfirm(totalSec);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Mark Complete</DialogTitle>
          <DialogDescription className="text-xs">
            Save your submission time for this problem.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Problem Info */}
          <div className="rounded-md bg-secondary/40 border border-border p-3 space-y-2">
            <div className="text-sm font-medium">{problem.title}</div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div
                  className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    difficultyDots[problem.difficulty]
                  )}
                />
                <span
                  className={cn(
                    'text-xs',
                    difficultyColors[problem.difficulty]
                  )}
                >
                  {problem.difficulty}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                Prev:{' '}
                <span className="font-mono">
                  {previousTime ? formatHMS(previousTime) : '--:--'}
                </span>
              </div>
            </div>
            {problem.tags && problem.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {problem.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-1.5 py-0.5 rounded bg-background text-muted-foreground border border-border"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Time Picker */}
          <div className="flex flex-col items-center">
            <label className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-2 self-start">
              Time
            </label>
            <div className="flex items-start gap-2">
              <TimeWheel value={hours} onChange={setHours} label="hrs" />
              <span className="text-muted-foreground text-lg font-mono mt-3">:</span>
              <TimeWheel value={minutes} onChange={setMinutes} max={59} label="min" />
              <span className="text-muted-foreground text-lg font-mono mt-3">:</span>
              <TimeWheel value={seconds} onChange={setSeconds} max={59} label="sec" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <div className="flex items-center gap-2 w-full">
            <Button
              variant="ghost"
              onClick={onCancel}
              className="flex-1 text-xs"
            >
              Cancel
            </Button>
            <Button onClick={handleConfirm} className="flex-1 text-xs">
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
