import { Button } from '@/components/ui/button';
import { Pause, Play, RefreshCcw, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

function formatHMS(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }

export default function Stopwatch() {
  // Stopwatch implementation
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isRunning) return;

    intervalRef.current = window.setInterval(() => {
      setElapsedTime(s => s + 1);
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [isRunning]);

  const reset = () => {
    setElapsedTime(0);
    setIsRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  const stop = () => {
    reset();
  }

  return (
    <div className="flex items-center rounded-md border bg-primary px-2 py-1 gap-2">
      {isRunning ? (
        <>
          <Button
            size="icon"
            className="h-6 w-6 hover:border-1 hover:border-accent"
            onClick={() => setIsRunning(false)}
          >
            <Pause />
          </Button>
          <Button
            size="icon"
            className="h-6 w-6 hover:border-1 hover:border-accent"
            onClick={() => stop()}
          >
            <Square />
          </Button>
        </>
      ) : (
        <>
          <Button
            size="icon"
            className="h-6 w-6 hover:border-1 hover:border-accent"
            onClick={() => setIsRunning(true)}
          >
            <Play />
          </Button>
          <Button
            size="icon"
            className="h-6 w-6 hover:border-1 hover:border-accent"
            onClick={() => reset()}
          >
            <RefreshCcw />
          </Button>
        </>
      )}

      <span className="text-sm font-mono text-background">{formatHMS(elapsedTime)}</span>
    </div>
  );
}
