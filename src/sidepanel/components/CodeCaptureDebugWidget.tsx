import { useEffect, useMemo, useState } from 'react';
import {
  type CurrentCodeSnapshot,
  isCodeSnapshotMessage,
} from '@/shared/types';

type Props = {
  currentProblemSlug?: string;
};

function countLines(code: string): number {
  if (!code) return 0;
  return code.split('\n').length;
}

function truncateSingleLine(code: string, max = 100): string {
  const oneLine = code.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max - 1)}...`;
}

function formatAge(at: number): string {
  const delta = Math.max(0, Date.now() - at);
  if (delta < 1000) return 'just now';
  const sec = Math.floor(delta / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  return `${min}m ago`;
}

export default function CodeCaptureDebugWidget({ currentProblemSlug }: Props) {
  const [snapshot, setSnapshot] = useState<CurrentCodeSnapshot | null>(null);
  const [ageLabel, setAgeLabel] = useState('');

  useEffect(() => {
    chrome.storage.local.get(['currentCodeSnapshot'], (data) => {
      const value = data.currentCodeSnapshot as CurrentCodeSnapshot | undefined;
      setSnapshot(value || null);
    });
  }, []);

  useEffect(() => {
    const onMessage = (msg: unknown) => {
      if (isCodeSnapshotMessage(msg)) {
        setSnapshot({
          slug: msg.slug,
          code: msg.code,
          source: msg.source,
          language: msg.language,
          at: msg.at,
        });
      }
    };

    const onStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area !== 'local' || !changes.currentCodeSnapshot) return;
      const nextValue = changes.currentCodeSnapshot
        .newValue as CurrentCodeSnapshot | null;
      setSnapshot(nextValue || null);
    };

    chrome.runtime.onMessage.addListener(onMessage);
    chrome.storage.onChanged.addListener(onStorageChange);

    return () => {
      chrome.runtime.onMessage.removeListener(onMessage);
      chrome.storage.onChanged.removeListener(onStorageChange);
    };
  }, []);

  useEffect(() => {
    if (!snapshot) {
      setAgeLabel('');
      return;
    }

    const update = () => {
      setAgeLabel(formatAge(snapshot.at));
    };

    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [snapshot]);

  const codeInfo = useMemo(() => {
    if (!snapshot) return null;
    return {
      chars: snapshot.code.length,
      lines: countLines(snapshot.code),
      preview: truncateSingleLine(snapshot.code),
    };
  }, [snapshot]);

  const isStaleForCurrentProblem =
    !!snapshot && !!currentProblemSlug && snapshot.slug !== currentProblemSlug;

  return (
    <div className="mx-4 mt-2 rounded-md border border-border/70 bg-secondary/20 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`h-2 w-2 rounded-full ${snapshot ? 'bg-emerald-500' : 'bg-amber-500'}`}
          />
          <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
            Code Capture Debug
          </p>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {snapshot ? ageLabel : 'waiting'}
        </p>
      </div>

      {snapshot && codeInfo ? (
        <div className="mt-1.5 space-y-1">
          <p className="text-xs text-foreground/90 break-all">
            {snapshot.slug}
            {snapshot.language ? ` (${snapshot.language})` : ''}
            {` - ${snapshot.source} - ${codeInfo.lines} lines - ${codeInfo.chars} chars`}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {codeInfo.preview}
          </p>
          {isStaleForCurrentProblem ? (
            <p className="text-[11px] text-amber-500">
              Snapshot slug differs from current problem.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">
          No code snapshot yet. Start typing in the LeetCode editor.
        </p>
      )}
    </div>
  );
}
