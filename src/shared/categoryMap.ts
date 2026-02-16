/**
 * Compact categories:
 * Smaller / niche LeetCode tags are merged into logical umbrellas.
 */
export const COMPACT_TOPICS = [
  'Arrays & Hashing',
  'Two Pointers / Sliding Window',
  'Stack & Queue',
  'Binary Search',
  'Linked List',
  'Intervals & Prefix / Difference',
  'Matrix / Simulation',
  'Tree',
  'Graph & Union-Find',
  'Backtracking & Recursion',
  'Dynamic Programming',
  'Greedy',
  'Math & Number Theory',
  'Bit Manipulation',
  'Strings & Parsing',
  'String Structures & Tries',
  'Heaps & Priority Structures',
  'Advanced Structures',
  'Geometry',
  'Design & Concurrency',
  'Randomized / Probability',
  'Other',
] as const;

export type CompactTopics = (typeof COMPACT_TOPICS)[number];

/**
 * Map raw LeetCode topic tag -> one or more compact categories.
 */
const TAG_TO_COMPACT: Record<string, CompactTopics[]> = {
  // Arrays / hashing core
  Array: ['Arrays & Hashing'],
  'Hash Table': ['Arrays & Hashing'],
  Counting: ['Arrays & Hashing'],
  Simulation: ['Matrix / Simulation'],
  Matrix: ['Matrix / Simulation'],

  // Sliding window / two pointers
  'Two Pointers': ['Two Pointers / Sliding Window'],
  'Sliding Window': ['Two Pointers / Sliding Window'],
  'Prefix Sum': ['Intervals & Prefix / Difference'],
  'Difference Array': ['Intervals & Prefix / Difference'],

  // Stack / queue / monotonic
  Stack: ['Stack & Queue'],
  'Monotonic Stack': ['Stack & Queue'],
  Queue: ['Stack & Queue'],
  'Monotonic Queue': ['Stack & Queue'],
  Deque: ['Stack & Queue'],

  // Heap / priority
  'Heap (Priority Queue)': ['Heaps & Priority Structures'],
  'Priority Queue': ['Heaps & Priority Structures'],

  // Binary search & ordered
  'Binary Search': ['Binary Search'],
  'Binary Search Tree': ['Tree'],
  'Ordered Set': ['Binary Search'],
  'Ordered Map': ['Binary Search'],

  // Linked list
  'Linked List': ['Linked List'],

  // Intervals / sweep / ranges
  Interval: ['Intervals & Prefix / Difference'],
  'Line Sweep': ['Intervals & Prefix / Difference'],
  'Range Query': ['Intervals & Prefix / Difference'],

  // Trees
  Tree: ['Tree'],
  'Binary Tree': ['Tree'],
  'Segment Tree': ['Advanced Structures'],
  'Binary Indexed Tree': ['Advanced Structures'],
  'Fenwick Tree': ['Advanced Structures'],
  'K-ary Tree': ['Tree'],
  Trie: ['String Structures & Tries'],

  // Graphs & union find
  Graph: ['Graph & Union-Find'],
  'Union Find': ['Graph & Union-Find'],
  'Minimum Spanning Tree': ['Graph & Union-Find'],
  'Shortest Path': ['Graph & Union-Find'],
  'Topological Sort': ['Graph & Union-Find'],
  'Strongly Connected Component': ['Graph & Union-Find'],

  // Traversal / recursion / backtracking
  'Depth-First Search': ['Graph & Union-Find', 'Backtracking & Recursion'],
  'Breadth-First Search': ['Graph & Union-Find'],
  Backtracking: ['Backtracking & Recursion'],
  Recursion: ['Backtracking & Recursion'],

  // Dynamic programming & variants
  'Dynamic Programming': ['Dynamic Programming'],
  Memoization: ['Dynamic Programming'],
  'Divide and Conquer': ['Dynamic Programming'],
  'Game Theory': ['Dynamic Programming'],

  // Greedy
  Greedy: ['Greedy'],

  // Math / number theory
  Math: ['Math & Number Theory'],
  'Number Theory': ['Math & Number Theory'],
  Combinatorics: ['Math & Number Theory'],
  'Probability and Statistics': ['Randomized / Probability'],
  Geometry: ['Geometry'],

  // Bit manipulation
  'Bit Manipulation': ['Bit Manipulation'],
  Bitmask: ['Bit Manipulation'],

  // Strings (basic)
  String: ['Strings & Parsing'],
  Parsing: ['Strings & Parsing'],
  Automaton: ['Strings & Parsing'],

  // String advanced structures
  'String Matching': ['String Structures & Tries'],
  'Rolling Hash': ['String Structures & Tries'],
  'Z-Function': ['String Structures & Tries'],
  'Suffix Array': ['String Structures & Tries'],
  'Suffix Tree': ['String Structures & Tries'],
  'Rabin-Karp': ['String Structures & Tries'],

  // Random / probability
  Randomized: ['Randomized / Probability'],

  // Design / concurrency
  Design: ['Design & Concurrency'],
  Concurrency: ['Design & Concurrency'],
  'LRU Cache': ['Design & Concurrency'],

  // Advanced structures
  'Union Find (Disjoint Set)': ['Graph & Union-Find'],
  'Ordered Statistics Tree': ['Advanced Structures'],
  'Skip List': ['Advanced Structures'],

  // Misc catch
  Enumeration: ['Other'],
  Brainteaser: ['Other'],
};

/**
 * Maps LeetCode tag names to compact categories set.
 * Unknown tags fall into 'Other'.
 */
export function mapTagsToCompact(tagNames: string[]): CompactTopics[] {
  const out = new Set<CompactTopics>();
  for (const raw of tagNames) {
    const cats = TAG_TO_COMPACT[raw];
    if (cats?.length) {
      for (const c of cats) {
        out.add(c);
      }
    } else {
      out.add('Other');
    }
  }
  return Array.from(out);
}

/**
 * Summarize counts by compact category.
 */
export function aggregateTopicCounts(
  tagLists: string[][]
): Record<CompactTopics, number> {
  const counts: Record<CompactTopics, number> = Object.fromEntries(
    COMPACT_TOPICS.map((c) => [c, 0])
  ) as Record<CompactTopics, number>;

  for (const tags of tagLists) {
    for (const cat of tags) {
      if (cat in counts) {
        counts[cat as CompactTopics] += 1;
      }
    }
  }
  return counts;
}
