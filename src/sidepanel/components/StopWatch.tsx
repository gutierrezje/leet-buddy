import { Button } from '@/components/ui/button';
import { CheckCircle, Pause, Play, RefreshCcw, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { formatHMS } from '@/shared/utils/time';

type StopwatchProps = {
  onStop?: (elapsed: number) => void;
  resetTrigger?: number;
};

export default function Stopwatch({ onStop, resetTrigger }: StopwatchProps) {
  // Stopwatch implementation
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const intervalRef = useRef<number | null>(null);

  // setup an interval to increment elapsed time every second when running
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

  // reset when resetTrigger changes
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

  return (
    <div className="flex items-center rounded-md border bg-primary px-2 py-1 gap-2">
      {isRunning ? (
        <>
          <Button
            size="icon"
            className="h-6 w-6 hover:border-1 hover:border-accent"
            onClick={handlePause}
          >
            <Pause />
          </Button>
          <Button
            size="icon"
            className="h-6 w-6 hover:border-1 hover:border-accent"
            onClick={handleStop}
          >
            <CheckCircle />
          </Button>
        </>
      ) : (
        <>
          <Button
            size="icon"
            className="h-6 w-6 hover:border-1 hover:border-accent"
            onClick={handleStart}
          >
            <Play />
          </Button>
          <Button
            size="icon"
            className="h-6 w-6 hover:border-1 hover:border-accent"
            onClick={handleReset}
          >
            <RefreshCcw />
          </Button>
        </>
      )}

      <span className="text-sm font-mono text-background">
        {formatHMS(elapsedTime)}
      </span>
    </div>
  );
}
