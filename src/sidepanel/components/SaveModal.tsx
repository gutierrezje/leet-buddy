import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useEffect, useState } from 'react';

import { CurrentProblem } from '@/shared/types';
import { formatHMS } from '@/shared/utils/time';
import { cn } from '@/lib/utils';

const difficultyColorsText: Record<string, string> = {
  Easy: 'text-difficulty-easy',
  Medium: 'text-difficulty-medium',
  Hard: 'text-difficulty-hard',
};

const difficultyColorsBg: Record<string, string> = {
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

  const pad = (n: number) => n.toString().padStart(2, '0');

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <h2 className="text-xl font-bold">Mark Complete?</h2>
        </DialogHeader>
        <div className="flex items-start flex-col w-full">
          <div className="text-xl font-semibold border-b w-full mb-2">
            Problem: {problem.title}
          </div>
          <div className="flex flex-row w-full justify-between">
            <div className="text-base mb-2">
              Difficulty:{' '}
              <div className="flex items-center gap-1">
                <div
                  className={cn(
                    'w-2 h-2 rounded-full',
                    difficultyColorsBg[problem.difficulty]
                  )}
                ></div>
                <span
                  className={cn(
                    'text-sm',
                    difficultyColorsText[problem.difficulty]
                  )}
                >
                  {problem.difficulty}
                </span>
              </div>
            </div>

            <div className="text-base mb-2">
              Previous Time:{' '}
              <div className="font-mono text-sm text-muted-foreground">
                {previousTime ? `${formatHMS(previousTime)}` : 'N/A'}
              </div>
            </div>
          </div>

          <div className="text-base mb-2">
            Tags:{' '}
            <div className="text-sm text-muted-foreground">
              {problem.tags?.join(', ')}
            </div>
          </div>

          <div className="flex flex-col items-start justify-center gap-2 w-full text-sm">
            <div className="block text-base font-medium">Time:</div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                value={pad(hours)}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setHours(isNaN(val) ? 0 : val);
                }}
                className="text-sm text-center font-mono"
              />
              <span>:</span>
              <Input
                type="number"
                min="0"
                max="59"
                value={pad(minutes)}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setMinutes(isNaN(val) ? 0 : val);
                }}
                className="text-sm text-center font-mono"
              />
              <span>:</span>
              <Input
                type="number"
                min="0"
                max="59"
                value={pad(seconds)}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setSeconds(isNaN(val) ? 0 : val);
                }}
                className="text-sm text-center font-mono"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <div className="flex items-center justify-center gap-2">
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={handleConfirm}>Save</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
