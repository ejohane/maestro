export interface Project {
  id: string;
  path: string;
  displayPath: string;
  name: string | null;
  displayName: string;
  addedAt: string;
  status: "active" | "missing";
}

export interface Directory {
  name: string;
  path: string;
  isGitRepo: boolean;
}

export interface BrowseResult {
  currentPath: string;
  displayPath: string;
  parent: string | null;
  canGoUp: boolean;
  directories: Directory[];
}

export interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  state: string;
  url: string;
  createdAt: string;
  author: {
    login: string;
  };
  labels: { name: string }[];
}
