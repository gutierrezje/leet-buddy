export type ProblemMeta = {
  title: string;
  difficulty: string;
  isPaidOnly: boolean;
  tags: string[];
};

export type CurrentProblem = {
  slug: string;
  title: string;
  difficulty?: string;
  tags?: string[];
};
