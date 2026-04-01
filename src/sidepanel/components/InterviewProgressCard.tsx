import type { InterviewChecklistItem, InterviewSession } from '@/shared/types';

type Props = {
  session: InterviewSession;
  stageChecklist: InterviewChecklistItem[];
  onSetStatus: (
    itemId: string,
    status: InterviewChecklistItem['status']
  ) => void;
  onAdvance: () => void;
  onComplete: () => void;
  onReset: () => void;
};

const STAGE_LABELS: Record<InterviewSession['stage'], string> = {
  before_coding: 'Before Coding',
  during_coding: 'During Coding',
  after_coding: 'After Coding',
  completed: 'Completed',
};

export default function InterviewProgressCard({
  session,
  stageChecklist,
  onSetStatus,
  onAdvance,
  onComplete,
  onReset,
}: Props) {
  return (
    <div className="mx-4 mt-3 rounded-md border border-border bg-secondary/20 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Interview Flow
        </p>
        <p className="text-xs text-foreground">{STAGE_LABELS[session.stage]}</p>
      </div>

      {session.stage !== 'completed' ? (
        <div className="mt-2 space-y-1.5">
          {stageChecklist.map((item) => (
            <div
              key={item.id}
              className="rounded-md border border-border/60 px-2 py-1.5"
            >
              <p className="text-xs text-foreground">{item.label}</p>
              <div className="mt-1 flex items-center gap-1">
                <button
                  type="button"
                  className={`rounded px-1.5 py-0.5 text-[11px] ${item.status === 'pending' ? 'bg-muted text-foreground' : 'bg-secondary/50 text-muted-foreground'}`}
                  onClick={() => onSetStatus(item.id, 'pending')}
                >
                  Pending
                </button>
                <button
                  type="button"
                  className={`rounded px-1.5 py-0.5 text-[11px] ${item.status === 'partial' ? 'bg-amber-500/20 text-amber-500' : 'bg-secondary/50 text-muted-foreground'}`}
                  onClick={() => onSetStatus(item.id, 'partial')}
                >
                  Partial
                </button>
                <button
                  type="button"
                  className={`rounded px-1.5 py-0.5 text-[11px] ${item.status === 'done' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-secondary/50 text-muted-foreground'}`}
                  onClick={() => onSetStatus(item.id, 'done')}
                >
                  Done
                </button>
              </div>
            </div>
          ))}

          <div className="flex items-center gap-2 pt-1">
            {session.stage !== 'after_coding' ? (
              <button
                type="button"
                onClick={onAdvance}
                className="rounded-md border border-border px-2 py-1 text-xs text-foreground"
              >
                Advance Stage
              </button>
            ) : (
              <button
                type="button"
                onClick={onComplete}
                className="rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-xs text-primary"
              >
                Finish & Rate
              </button>
            )}
            <button
              type="button"
              onClick={onReset}
              className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground"
            >
              Reset
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 rounded-md border border-border/60 px-2 py-2 text-xs text-foreground">
          <p>Overall: {session.score?.overall ?? 0}</p>
          <p>Verdict: {session.score?.recommendation ?? 'N/A'}</p>
          <p>
            DSA {session.score?.dsa ?? 0} • Comm{' '}
            {session.score?.communication ?? 0} • Coding{' '}
            {session.score?.coding ?? 0} • Testing {session.score?.testing ?? 0}{' '}
            • Speed {session.score?.speed ?? 0}
          </p>
        </div>
      )}
    </div>
  );
}
