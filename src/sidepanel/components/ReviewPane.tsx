import { Card } from '@/components/ui/card';
import { getAllSubmissions } from '@/shared/submissions';
import { SubmissionRecord, TopicStats } from '@/shared/types';
import { useEffect, useState } from 'react';
import { TopicsView } from './TopicHeatmap';
import { computeTopicStats } from '@/shared/utils/topicStats';
import { createLogger } from '@/shared/utils/debug';

const debug = createLogger('review-pane');

export default function ReviewPane() {
  const [submissions, setSubmissions] = useState<
    Record<string, SubmissionRecord>
  >({});
  const [categoryStats, setCategoryStats] = useState<
    Record<string, TopicStats>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initial load
    setLoading(true);
    setError(null);

    getAllSubmissions()
      .then((data) => {
        setSubmissions(data);
        const stats = computeTopicStats(Object.values(data));
        setCategoryStats(stats);
        setLoading(false);
      })
      .catch((err) => {
        debug('Error loading submissions: %O', err);
        setError('Failed to load submissions');
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
      if (touched.length > 0) {
        setLoading(true);
        setError(null);

        getAllSubmissions()
          .then((data) => {
            setSubmissions(data);
            const stats = computeTopicStats(Object.values(data));
            setCategoryStats(stats);
            setLoading(false);
          })
          .catch((err) => {
            debug('Error reloading submissions: %O', err);
            setError('Failed to reload submissions');
            setLoading(false);
          });
      }
    };

    chrome.storage.onChanged.addListener(onStorageChange);
    return () => chrome.storage.onChanged.removeListener(onStorageChange);
  }, []);

  if (loading) {
    return <div className="p-4 text-sm">Loading...</div>;
  }

  if (error) {
    return (
      <div className="p-4 text-sm">
        <h2 className="text-lg font-semibold">Review</h2>
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  const entries = Object.entries(submissions);

  debug('ReviewPane entries: %O', entries);

  if (entries.length === 0) {
    return (
      <div className="p-4 text-sm">
        <h2 className="text-lg font-semibold">Review</h2>
        <p className="text-muted-foreground">No submissions yet.</p>
      </div>
    );
  }

  // Count by difficulty
  const difficultyCounts: Record<string, number> = {
    Easy: 0,
    Medium: 0,
    Hard: 0,
  };
  for (const [_, rec] of entries) {
    const difficulty = rec.problem.difficulty;
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
              <span className="text-difficulty-easy ">
                {difficultyCounts.Easy}E
              </span>
              <span className="text-difficulty-medium">
                {difficultyCounts.Medium}M
              </span>
              <span className="text-difficulty-hard">
                {difficultyCounts.Hard}H
              </span>
            </div>
          </Card>
        </div>
      </div>

      <div>
        <div className="text-lg font-semibold">Topic Coverage: </div>
        <TopicsView categoryStats={categoryStats} />
      </div>
    </div>
  );
}
