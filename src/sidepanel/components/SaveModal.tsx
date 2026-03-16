import { ChevronDown, ChevronUp } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { CurrentProblem } from '@/shared/types';
import { formatHMS } from '@/shared/utils/time';

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
  const [inputValue, setInputValue] = useState(value.toString());
  const [isFocused, setIsFocused] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isFocused) {
      setInputValue(value.toString());
    }
  }, [value, isFocused]);

  const stopAction = useCallback(() => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    if (intervalRef.current) window.clearInterval(intervalRef.current);
  }, []);

  useEffect(() => {
    const handleGlobalPointerUp = () => stopAction();
    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      stopAction();
    };
  }, [stopAction]);

  const step = (direction: 1 | -1) => {
    setInputValue((prev) => {
      let num = parseInt(prev, 10);
      if (Number.isNaN(num)) num = 0;
      let next = num + direction;
      if (max !== undefined) {
        if (next > max) next = 0;
        else if (next < 0) next = max;
      } else if (next < 0) {
        next = 0;
      }
      onChange(next);
      return next.toString();
    });
  };

  const startAction = (direction: 1 | -1) => {
    step(direction);
    let ticks = 0;

    timeoutRef.current = window.setTimeout(() => {
      intervalRef.current = window.setInterval(() => {
        step(direction);
        ticks++;
        if (ticks === 5 && intervalRef.current) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = window.setInterval(() => step(direction), 50);
        }
      }, 150);
    }, 500);
  };

  const displayValue = isFocused ? inputValue : inputValue.padStart(2, '0');

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          startAction(1);
        }}
        onPointerUp={stopAction}
        onPointerLeave={stopAction}
        onPointerCancel={stopAction}
        className="p-0.5 rounded text-muted-foreground hover:text-primary transition-colors cursor-pointer select-none touch-none"
      >
        <ChevronUp className="h-4 w-4" />
      </button>
      <div className="w-12 h-10 rounded-md bg-secondary border border-border flex items-center justify-center overflow-hidden focus-within:ring-1 focus-within:ring-ring focus-within:border-ring transition-shadow">
        <input
          type="text"
          inputMode="numeric"
          className="w-full text-center bg-transparent outline-none text-base font-mono tabular-nums text-foreground p-0 m-0 border-none"
          value={displayValue}
          onFocus={() => setIsFocused(true)}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, '');
            setInputValue(val);
          }}
          onBlur={() => {
            setIsFocused(false);
            let num = parseInt(inputValue, 10);
            if (Number.isNaN(num)) num = 0;
            if (max !== undefined && num > max) num = max;
            setInputValue(num.toString());
            onChange(num);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              step(1);
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              step(-1);
            } else if (e.key === 'Enter') {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
        />
      </div>
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          startAction(-1);
        }}
        onPointerUp={stopAction}
        onPointerLeave={stopAction}
        onPointerCancel={stopAction}
        className="p-0.5 rounded text-muted-foreground hover:text-primary transition-colors cursor-pointer select-none touch-none"
      >
        <ChevronDown className="h-4 w-4" />
      </button>
      <span className="text-xs text-muted-foreground select-none">{label}</span>
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
            <div className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-2 self-start">
              Time
            </div>
            <div className="flex items-start gap-2">
              <TimeWheel value={hours} onChange={setHours} label="hrs" />
              <span className="text-muted-foreground text-lg font-mono mt-3">
                :
              </span>
              <TimeWheel
                value={minutes}
                onChange={setMinutes}
                max={59}
                label="min"
              />
              <span className="text-muted-foreground text-lg font-mono mt-3">
                :
              </span>
              <TimeWheel
                value={seconds}
                onChange={setSeconds}
                max={59}
                label="sec"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <div className="flex items-center gap-2 w-full">
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              className="flex-1 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              className="flex-1 text-xs"
            >
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
