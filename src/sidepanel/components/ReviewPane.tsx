import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { aggregateCategoryCounts } from '@/shared/categoryMap';
import { getAllRecentSubmissions } from '@/shared/submissions';
import { SubmissionRecord } from '@/shared/types';
import { useEffect, useState } from 'react';
import { PatternHeatmap } from './PatternHeatmap';

export default function ReviewPane() {
  const [submissions, setSubmissions] = useState<
    Record<string, SubmissionRecord[]>
  >({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Initial load
    getAllRecentSubmissions().then((data) => {
      setSubmissions(data);
      setLoading(false);
    });

    // Listen for storage changes
    const onStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      // Only care about chrome.storage.local changes
      if (area !== 'local') return;
      // Check for changed keys related to submissions
      const touched = Object.keys(changes).filter((k) =>
        k.startsWith('submissions::')
      );
      if (touched) {
        getAllRecentSubmissions().then(setSubmissions);
      }
    };

    chrome.storage.onChanged.addListener(onStorageChange);
    return () => chrome.storage.onChanged.removeListener(onStorageChange);
  }, []);

  if (loading) {
    return <div className="p-4 text-sm">Loading...</div>;
  }

  const entries = Object.entries(submissions);

  console.log('ReviewPane entries:', entries);

  if (entries.length === 0) {
    return (
      <div className="p-4 text-sm">
        <h2 className="text-lg font-semibold">Review</h2>
        <p className="text-muted-foreground">No submissions yet.</p>
      </div>
    );
  }

  const allTagLists = entries.flatMap(([_, recs]) =>
    recs
      .filter((r) => r.problem.tags && r.problem.tags.length > 0)
      .map((r) => r.problem.tags!)
  );

  const categoryCounts = aggregateCategoryCounts(allTagLists);

  const sortedCategories = Object.entries(categoryCounts)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  // Count by difficulty
  const difficultyCounts: Record<string, number> = {
    Easy: 0,
    Medium: 0,
    Hard: 0,
  };
  for (const [_, recs] of entries) {
    const difficulty = recs[0]?.problem.difficulty;
    if (difficulty) {
      difficultyCounts[difficulty] = (difficultyCounts[difficulty] || 0) + 1;
    }
  }

  return (
    <div className="px-4 text-sm space-y-3">
      <div className="border-b mt-2">
        <div className="text-lg font-semibold">Overview: </div>
        <div className="flex justify-center my-2 gap-4">
          <Card className="flex flex-grow items-center justify-center flex-col gap-0 py-2">
            <div className="text-2xl font-bold text-primary">
              {entries.length}
            </div>
            <div>Completed</div>
          </Card>
          <Card className="flex flex-grow items-center justify-center flex-col gap-1 py-2">
            <div>Difficulty Split</div>
            <div className="flex flex-row items-center justify-center gap-4">
              <span className="text-difficulty-easy ">{difficultyCounts.Easy}E</span>
              <span className="text-difficulty-medium">
                {difficultyCounts.Medium}M
              </span>
              <span className="text-difficulty-hard">{difficultyCounts.Hard}H</span>
            </div>
          </Card>
        </div>
      </div>

      <div>
        <div className="text-lg font-semibold">Topic Coverage: </div>
        {/* <ScrollArea> */}
          <PatternHeatmap />
        {/* </ScrollArea> */}
      </div>

      <div>
        <div className="text-lg font-semibold">Recently Completed:</div>
        <ul className="list-disc list-inside">
          {entries.slice(0, 10).map(([slug, recs]) => (
            <li key={slug}>
              {recs[0]?.problem.title} (
              {recs[0]?.problem.difficulty || 'Unknown'})
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
