import { aggregateCategoryCounts } from "@/shared/categoryMap";
import { getAllRecentSubmissions } from "@/shared/submissions";
import { SubmissionRecord } from "@/shared/types";
import { useEffect, useState } from "react";

export default function ReviewPane() {
  const [submissions, setSubmissions] = useState<Record<string, SubmissionRecord[]>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Initial load
    getAllRecentSubmissions().then(data => {
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
      const touched = Object.keys(changes).filter(k => k.startsWith('submissions::'));
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
      .filter(r => r.problem.tags && r.problem.tags.length > 0)
      .map(r => r.problem.tags!)
  );

  const categoryCounts = aggregateCategoryCounts(allTagLists);

  const sortedCategories = Object.entries(categoryCounts)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  // Count by difficulty
  const difficultyCounts: Record<string, number> = {};
  for(const [_, recs] of entries) {
    const difficulty = recs[0]?.problem.difficulty;
    if (difficulty) {
      difficultyCounts[difficulty] = (difficultyCounts[difficulty] || 0) + 1;
    }
  }

  return (
    <div className="p-4 text-sm space-y-3">
      <h2 className="text-lg font-semibold">Completion Overview: </h2>
      <div>{entries.length} Completed</div>

      <div>Difficulty Breakdown:</div>
      <ul className="list-disc list-inside">
        {Object.entries(difficultyCounts).map(([difficulty, count]) => (
          <li key={difficulty}>
            {difficulty}: {count}
          </li>
        ))}
      </ul>

      <div>Pattern Coverage: </div>
      <ul className="list-disc list-inside">
        {sortedCategories.map(([cat, count]) => (
          <li key={cat}>
            {cat}: {count}
          </li>
        ))}
      </ul>

      <div>Recently Completed:</div>
      <ul className="list-disc list-inside">
        {entries.slice(0, 10).map(([slug, recs]) => (
          <li key={slug}>
            {recs[0]?.problem.title} ({recs[0]?.problem.difficulty || 'Unknown'})
          </li>
        ))}
      </ul>

    </div>
  );
}
