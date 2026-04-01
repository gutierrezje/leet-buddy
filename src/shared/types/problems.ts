export type CurrentProblem = {
  slug: string;
  title: string;
  difficulty: string;
  tags: string[];
  startAt?: number;
};

export type CurrentCodeSnapshot = {
  slug: string;
  code: string;
  source: 'monaco' | 'textarea' | 'view-lines' | 'pre-code';
  language?: string;
  hasNonCommentCode?: boolean;
  nonCommentFingerprint?: string;
  at: number;
};

export type TopicStats = {
  topic: string;
  totalProblems: number;
  totalTime: number;
  avgTime: number;
  difficulties: {
    Easy: number;
    Medium: number;
    Hard: number;
  };
};
