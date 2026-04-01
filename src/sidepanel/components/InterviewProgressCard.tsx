import type { InterviewChecklistItem, InterviewSession } from '@/shared/types';

type Props = {
  session: InterviewSession;
  stageChecklist: InterviewChecklistItem[];
  canAdvance: boolean;
  onAdvance: () => void;
  onComplete: () => void;
  onReset: () => void;
};

function StatusBadge({ status }: { status: InterviewChecklistItem['status'] }) {
  const className =
    status === 'done'
      ? 'bg-emerald-500/15 text-emerald-500'
      : status === 'partial'
        ? 'bg-amber-500/15 text-amber-500'
        : 'bg-secondary/50 text-muted-foreground';

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] uppercase ${className}`}
    >
      {status}
    </span>
  );
}

function renderList(items: string[], empty: string) {
  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground">{empty}</p>;
  }

  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li key={item} className="text-xs text-foreground">
          {item}
        </li>
      ))}
    </ul>
  );
}

export default function InterviewProgressCard({
  session,
  stageChecklist,
  canAdvance,
  onAdvance,
  onComplete,
  onReset,
}: Props) {
  const { derivedState, finalAssessment } = session;

  return (
    <div className="mx-4 mt-3 rounded-md border border-border bg-secondary/20 px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Interview Flow
          </p>
          <p className="mt-1 text-sm text-foreground">
            {derivedState.stageLabel}
          </p>
        </div>
        {derivedState.stage !== 'completed' ? (
          <span
            className={`rounded-full px-2 py-1 text-[10px] uppercase ${
              canAdvance
                ? 'bg-primary/15 text-primary'
                : 'bg-secondary/50 text-muted-foreground'
            }`}
          >
            {canAdvance ? 'Ready to advance' : 'In progress'}
          </span>
        ) : null}
      </div>

      {derivedState.stage !== 'completed' ? (
        <div className="mt-3 space-y-3">
          <section className="rounded-md border border-border/60 px-2 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Current Coverage
            </p>
            <div className="mt-2 space-y-2">
              {stageChecklist.map((item) => (
                <div
                  key={item.id}
                  className="rounded-md bg-background/60 px-2 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-foreground">{item.label}</p>
                    <StatusBadge status={item.status} />
                  </div>
                  {item.evidence.length > 0 ? (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {item.evidence[0]}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <div className="grid gap-3 md:grid-cols-2">
            <section className="rounded-md border border-border/60 px-2 py-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Strengths Observed
              </p>
              <div className="mt-2">
                {renderList(
                  derivedState.strengths,
                  'Strengths will appear as evidence is collected.'
                )}
              </div>
            </section>

            <section className="rounded-md border border-border/60 px-2 py-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Missing Areas
              </p>
              <div className="mt-2">
                {renderList(
                  derivedState.missingAreas,
                  'No gaps in the current stage.'
                )}
              </div>
            </section>
          </div>

          <section className="rounded-md border border-border/60 px-2 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Interview Memory
            </p>
            <div className="mt-2 space-y-1.5 text-xs text-foreground">
              {derivedState.approachSummary.selected ? (
                <p>Chosen approach: {derivedState.approachSummary.selected}</p>
              ) : null}
              {derivedState.complexityClaims.time ? (
                <p>Time complexity: {derivedState.complexityClaims.time}</p>
              ) : null}
              {derivedState.complexityClaims.space ? (
                <p>Space complexity: {derivedState.complexityClaims.space}</p>
              ) : null}
              {derivedState.nextFollowUp ? (
                <p>Next follow-up: {derivedState.nextFollowUp}</p>
              ) : (
                <p className="text-muted-foreground">
                  No immediate follow-up needed.
                </p>
              )}
            </div>
          </section>

          <div className="flex items-center gap-2 pt-1">
            {derivedState.stage !== 'after_coding' ? (
              <button
                type="button"
                onClick={onAdvance}
                disabled={!canAdvance}
                className="rounded-md border border-border px-2 py-1 text-xs text-foreground disabled:opacity-40 disabled:pointer-events-none"
              >
                Advance Stage
              </button>
            ) : (
              <button
                type="button"
                onClick={onComplete}
                className="rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-xs text-primary"
              >
                Finish &amp; Rate
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
        <div className="mt-3 space-y-3 rounded-md border border-border/60 px-3 py-3 text-xs text-foreground">
          <p>Recommendation: {finalAssessment?.recommendation ?? 'N/A'}</p>
          <p>Overall score: {finalAssessment?.overall ?? 'N/A'}</p>
          {finalAssessment?.rationale ? (
            <p className="text-muted-foreground">{finalAssessment.rationale}</p>
          ) : null}
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Key strengths
            </p>
            <div className="mt-2">
              {renderList(
                derivedState.strengths,
                'No strengths were captured for this session.'
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
