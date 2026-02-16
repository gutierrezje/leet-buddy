import { CheckCircle, Pause, Play, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { formatHMS } from '@/shared/utils/time';
import { cn } from '@/lib/utils';

type StopwatchProps = {
  onStop?: (elapsed: number) => void;
  resetTrigger?: number;
};

export default function Stopwatch({ onStop, resetTrigger }: StopwatchProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isRunning) return;

    intervalRef.current = window.setInterval(() => {
      setElapsedTime((s) => s + 1);
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning]);

  useEffect(() => {
    setIsRunning(false);
    setElapsedTime(0);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [resetTrigger]);

  const handleStart = () => setIsRunning(true);
  const handlePause = () => setIsRunning(false);

  const handleReset = () => {
    setElapsedTime(0);
    setIsRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const handleStop = () => {
    setIsRunning(false);
    onStop?.(elapsedTime);
  };

  const iconBtn =
    'p-1.5 rounded text-muted-foreground hover:text-primary transition-colors';

  return (
    <div className="flex items-center gap-1.5 rounded-md bg-secondary/50 px-2.5 py-1.5">
      <span
        className={cn(
          'text-xs font-mono tabular-nums',
          isRunning ? 'text-primary' : 'text-muted-foreground'
        )}
      >
        {formatHMS(elapsedTime)}
      </span>
      <div className="w-px h-4 bg-border" />
      {isRunning ? (
        <>
          <button className={iconBtn} onClick={handlePause}>
            <Pause className="h-3.5 w-3.5" />
          </button>
          <button className={iconBtn} onClick={handleStop}>
            <CheckCircle className="h-3.5 w-3.5" />
          </button>
        </>
      ) : (
        <>
          <button className={iconBtn} onClick={handleStart}>
            <Play className="h-3.5 w-3.5" />
          </button>
          <button className={iconBtn} onClick={handleReset}>
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  );
}
