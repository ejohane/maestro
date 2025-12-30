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
