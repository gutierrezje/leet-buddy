export type CurrentProblem = {
  slug: string;
  title: string;
  difficulty: string;
  tags: string[];
  startAt?: number;
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
