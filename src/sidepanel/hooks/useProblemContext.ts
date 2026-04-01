import { useEffect, useRef, useState } from 'react';
import { mapTagsToCompact } from '@/shared/categoryMap';
import {
  type CurrentCodeSnapshot,
  type CurrentProblem,
  isCodeSnapshotMessage,
  isProblemClearedMessage,
  isProblemMetadataMessage,
} from '@/shared/types';
import { createLogger } from '@/shared/utils/debug';

const debug = createLogger('useProblemContext');

export function useProblemContext() {
  const [currentProblem, setCurrentProblem] = useState<CurrentProblem | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [currentCodeSnapshot, setCurrentCodeSnapshot] =
    useState<CurrentCodeSnapshot | null>(null);
  const lastSlugRef = useRef<string | null>(null);

  // Bootstrap from storage on mount
  useEffect(() => {
    chrome.storage.local.get(
      ['currentProblem', 'currentCodeSnapshot'],
      (data) => {
        const cp = data.currentProblem;
        const snapshot = data.currentCodeSnapshot as
          | CurrentCodeSnapshot
          | undefined;
        if (cp?.slug && cp?.title) {
          const compact = mapTagsToCompact(cp.tags || []);
          if (lastSlugRef.current !== cp.slug) {
            debug('Bootstrapped problem slug from storage: %s', cp.slug);
            setCurrentProblem({
              slug: cp.slug,
              title: cp.title,
              difficulty: cp.difficulty || '',
              tags: compact,
              startAt: cp.startAt,
            });
            lastSlugRef.current = cp.slug;
          }
        }
        if (snapshot?.slug && snapshot?.code) {
          setCurrentCodeSnapshot(snapshot);
        }
        setLoading(false);
      }
    );
  }, []);

  // Subscribe to messages from content script
  useEffect(() => {
    function handleMessage(msg: unknown) {
      // Handle problem cleared (user navigated away from problem page)
      if (isProblemClearedMessage(msg)) {
        debug('Problem cleared, resetting state');
        lastSlugRef.current = null;
        setCurrentProblem(null);
        setCurrentCodeSnapshot(null);
        return;
      }

      if (isCodeSnapshotMessage(msg)) {
        setCurrentCodeSnapshot({
          slug: msg.slug,
          code: msg.code,
          source: msg.source,
          language: msg.language,
          hasNonCommentCode: msg.hasNonCommentCode,
          nonCommentFingerprint: msg.nonCommentFingerprint,
          at: msg.at,
        });
        return;
      }

      // Handle problem metadata updates
      if (isProblemMetadataMessage(msg)) {
        const compact = mapTagsToCompact(msg.tags || []);
        debug('Received PROBLEM_METADATA for %s', msg.slug);
        debug('compact categories: %O', compact);

        if (lastSlugRef.current !== msg.slug) {
          // New problem or re-entry to different problem
          debug('New problem detected: %s', msg.slug);
          lastSlugRef.current = msg.slug;
          setCurrentProblem({
            slug: msg.slug,
            title: msg.title,
            difficulty: msg.difficulty,
            tags: compact,
            startAt: msg.startAt,
          });
        } else {
          // Same slug: update metadata (handles re-entry with fresh data)
          debug('Updating metadata for current problem: %s', msg.slug);
          setCurrentProblem((prev) => {
            if (prev) {
              return {
                ...prev,
                title: msg.title,
                difficulty: msg.difficulty,
                tags: compact.length > 0 ? compact : prev.tags,
              };
            }
            return prev;
          });
        }
      }
    }

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  return {
    currentProblem,
    currentCodeSnapshot,
    loading,
  };
}
