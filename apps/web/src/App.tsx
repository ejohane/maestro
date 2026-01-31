import React from "react";
import { Badge } from "./components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "./components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { cn } from "./lib/utils";

type CurrentContext = {
  projectId?: string;
  conversationId?: string;
  sessionId?: string;
};

type Project = {
  id: string;
  name: string;
  repoPath: string;
  defaultBranch: string;
  createdAt: string;
  updatedAt: string;
};

type Conversation = {
  id: string;
  projectId: string;
  title?: string;
  branch: string;
  workspacePath: string;
  baseRef: string;
  baseSha: string;
  stashRef?: string | null;
  createdAt: string;
  updatedAt: string;
};

type Session = {
  id: string;
  conversationId: string;
  title?: string;
  model?: string;
  createdAt: string;
  updatedAt: string;
};

type TranscriptEntry = {
  role?: string;
  content?: string;
};

const readErrorMessage = async (res: Response): Promise<string> => {
  const text = await res.text();
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const parsed = JSON.parse(text) as { error?: string; message?: string };
      if (typeof parsed.error === "string" && parsed.error.trim()) {
        return parsed.error;
      }
      if (typeof parsed.message === "string" && parsed.message.trim()) {
        return parsed.message;
      }
    } catch {
      return text;
    }
  }
  return text || `Request failed: ${res.status}`;
};

const buildApiPath = (path: string, repoPath?: string): string => {
  if (!repoPath) {
    return path;
  }
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}repoPath=${encodeURIComponent(repoPath)}`;
};

const fetchJson = async <T,>(path: string, repoPath?: string): Promise<T> => {
  const res = await fetch(`/api${buildApiPath(path, repoPath)}`);
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return res.json() as Promise<T>;
};

const postJson = async <T,>(path: string, payload: unknown, repoPath?: string): Promise<T> => {
  const res = await fetch(`/api${buildApiPath(path, repoPath)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return res.json() as Promise<T>;
};

const formatTime = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const App = () => {
  const [current, setCurrent] = React.useState<CurrentContext>({});
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [sessions, setSessions] = React.useState<Session[]>([]);
  const [selectedConversationId, setSelectedConversationId] = React.useState<string | null>(
    null
  );
  const [selectedSessionId, setSelectedSessionId] = React.useState<string | null>(null);
  const [transcript, setTranscript] = React.useState<TranscriptEntry[]>([]);
  const [events, setEvents] = React.useState<unknown[]>([]);
  const [status, setStatus] = React.useState<string>("Idle");
  const [error, setError] = React.useState<string | null>(null);
  const [activeRepoPath, setActiveRepoPath] = React.useState<string>("");
  const [newProjectName, setNewProjectName] = React.useState<string>("");
  const [newProjectBranch, setNewProjectBranch] = React.useState<string>("main");
  const [newProjectPath, setNewProjectPath] = React.useState<string>("");
  const [creatingProject, setCreatingProject] = React.useState<boolean>(false);
  const [selectingProjectPath, setSelectingProjectPath] = React.useState<boolean>(false);
  const [projectError, setProjectError] = React.useState<string | null>(null);
  const [newConversationTitle, setNewConversationTitle] = React.useState<string>("");
  const [creatingConversation, setCreatingConversation] = React.useState<boolean>(false);
  const [conversationError, setConversationError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const loadRoot = async () => {
      try {
        const rootInfo = await fetchJson<{ path: string }>("/fs/root");
        setActiveRepoPath(rootInfo.path);
        setNewProjectPath(rootInfo.path);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    };
    void loadRoot();
  }, []);

  React.useEffect(() => {
    if (activeRepoPath && !newProjectPath) {
      setNewProjectPath(activeRepoPath);
    }
  }, [activeRepoPath, newProjectPath]);

  React.useEffect(() => {
    const load = async () => {
      try {
        setStatus("Loading workspace");
        const [currentContext, projectList, conversationList] = await Promise.all([
          fetchJson<CurrentContext>("/current", activeRepoPath || undefined),
          fetchJson<Project[]>("/projects?all=1"),
          fetchJson<Conversation[]>("/conversations", activeRepoPath || undefined)
        ]);
        setCurrent(currentContext);
        setProjects(projectList);
        setConversations(conversationList);
        const preferredConversation =
          currentContext.conversationId ?? conversationList[0]?.id ?? null;
        setSelectedConversationId(preferredConversation);
        setStatus("Ready");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setStatus("Error");
      }
    };
    void load();
  }, [activeRepoPath]);

  React.useEffect(() => {
    const loadSessions = async () => {
      if (!selectedConversationId) {
        setSessions([]);
        setSelectedSessionId(null);
        return;
      }
      try {
        setStatus("Loading sessions");
        const sessionList = await fetchJson<Session[]>(
          `/conversations/${selectedConversationId}/sessions`,
          activeRepoPath || undefined
        );
        setSessions(sessionList);
        const preferredSession =
          sessionList.find((session) => session.id === current.sessionId)?.id ??
          sessionList[0]?.id ??
          null;
        setSelectedSessionId(preferredSession);
        setStatus("Ready");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setStatus("Error");
      }
    };
    void loadSessions();
  }, [selectedConversationId, current.sessionId, activeRepoPath]);

  React.useEffect(() => {
    const loadLogs = async () => {
      if (!selectedConversationId || !selectedSessionId) {
        setTranscript([]);
        setEvents([]);
        return;
      }
      try {
        setStatus("Loading logs");
        const [transcriptEntries, eventEntries] = await Promise.all([
          fetchJson<TranscriptEntry[]>(
            `/conversations/${selectedConversationId}/sessions/${selectedSessionId}/transcript`,
            activeRepoPath || undefined
          ),
          fetchJson<unknown[]>(
            `/conversations/${selectedConversationId}/sessions/${selectedSessionId}/events`,
            activeRepoPath || undefined
          )
        ]);
        setTranscript(transcriptEntries);
        setEvents(eventEntries);
        setStatus("Ready");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setStatus("Error");
      }
    };
    void loadLogs();
  }, [selectedConversationId, selectedSessionId, activeRepoPath]);

  const currentProject = React.useMemo(
    () => projects.find((project) => project.id === current.projectId),
    [projects, current.projectId]
  );

  const activeProject = React.useMemo(
    () => projects.find((project) => project.repoPath === activeRepoPath),
    [projects, activeRepoPath]
  );

  const selectedConversation = React.useMemo(
    () => conversations.find((item) => item.id === selectedConversationId),
    [conversations, selectedConversationId]
  );

  const handleCreateProject = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newProjectName.trim();
    if (!name || creatingProject) {
      return;
    }
    const defaultBranch = newProjectBranch.trim() || "main";
    const repoPath = newProjectPath.trim();
    try {
      setCreatingProject(true);
      setProjectError(null);
      const created = await postJson<Project>("/projects", {
        name,
        defaultBranch,
        repoPath: repoPath || undefined
      });
      setProjects((prev) => [created, ...prev.filter((project) => project.id !== created.id)]);
      setActiveRepoPath(created.repoPath);
      setNewProjectPath(created.repoPath);
      setNewProjectName("");
      setNewProjectBranch("main");
    } catch (err) {
      setProjectError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreatingProject(false);
    }
  };

  const handleSelectProjectPath = async () => {
    if (selectingProjectPath) {
      return;
    }
    try {
      setSelectingProjectPath(true);
      setProjectError(null);
      const result = await postJson<{ path: string }>("/fs/select-directory", {
        startPath: newProjectPath || activeRepoPath || undefined
      });
      setNewProjectPath(result.path);
    } catch (err) {
      setProjectError(err instanceof Error ? err.message : String(err));
    } finally {
      setSelectingProjectPath(false);
    }
  };

  const handleCreateConversation = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeProject || creatingConversation) {
      return;
    }
    try {
      setCreatingConversation(true);
      setConversationError(null);
      const created = await postJson<{
        project: Project;
        conversation: Conversation;
        session: Session;
      }>("/conversations", {
        projectId: activeProject.id,
        title: newConversationTitle.trim() || undefined
      });
      setActiveRepoPath(created.project.repoPath);
      setNewProjectPath(created.project.repoPath);
      setNewConversationTitle("");
      setSelectedConversationId(created.conversation.id);
    } catch (err) {
      setConversationError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreatingConversation(false);
    }
  };

  return (
    <div className="min-h-screen px-6 py-10 md:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="rounded-3xl border border-border/70 bg-card/70 p-6 shadow-[0_30px_60px_-40px_rgba(28,60,46,0.5)] backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-display text-3xl text-foreground">Maestro Console</p>
              <p className="text-sm text-muted-foreground">
                Local conversations and sessions tracked in your repo
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Project</p>
                <p className="text-sm font-semibold">
                  {currentProject?.name ?? "None"}
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Active</p>
                <p className="text-sm font-semibold">
                  {current.conversationId && current.sessionId
                    ? `${current.conversationId} / ${current.sessionId}`
                    : "-"}
                </p>
              </div>
            </div>
          </div>
        </header>

        {error ? (
          <div className="rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-foreground">
            {error}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <div className="flex flex-col gap-6">
            <Card className="border-border/70 bg-card/80">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Projects</CardTitle>
                  <Badge variant="secondary">{projects.length}</Badge>
                </div>
                <CardDescription>Registered repositories in this workspace</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border border-border/70 bg-background/80 px-3 py-2 text-xs text-muted-foreground">
                  Active repo: {activeRepoPath || "Loading..."}
                </div>
                <form className="space-y-3" onSubmit={handleCreateProject}>
                  <div className="space-y-1">
                    <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Project name
                    </label>
                    <input
                      value={newProjectName}
                      onChange={(event) => setNewProjectName(event.target.value)}
                      placeholder="Maestro UI"
                      className="w-full rounded-xl border border-border/70 bg-background/80 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Project folder
                    </label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        value={newProjectPath}
                        onChange={(event) => setNewProjectPath(event.target.value)}
                        placeholder="/path/to/repo"
                        className="w-full rounded-xl border border-border/70 bg-background/80 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      />
                      <button
                        type="button"
                        onClick={handleSelectProjectPath}
                        disabled={selectingProjectPath}
                        className="rounded-xl border border-border/70 bg-background/80 px-4 py-2 text-sm font-semibold text-foreground transition hover:border-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {selectingProjectPath ? "Picking..." : "Browse"}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Default branch
                    </label>
                    <input
                      value={newProjectBranch}
                      onChange={(event) => setNewProjectBranch(event.target.value)}
                      placeholder="main"
                      className="w-full rounded-xl border border-border/70 bg-background/80 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!newProjectName.trim() || creatingProject}
                    className="w-full rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {creatingProject ? "Creating..." : "Create project"}
                  </button>
                  {projectError ? (
                    <div className="rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-foreground">
                      {projectError}
                    </div>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Projects are stored in ~/.maestro.
                  </p>
                </form>

                <div className="space-y-3">
                  {projects.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
                      No projects yet.
                    </div>
                  ) : (
                    projects.map((project) => {
                      const isActive = project.repoPath === activeRepoPath;
                      return (
                        <button
                          key={project.id}
                          type="button"
                          onClick={() => {
                            setActiveRepoPath(project.repoPath);
                            setNewProjectPath(project.repoPath);
                          }}
                          className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                            isActive
                              ? "border-primary/50 bg-primary/10"
                              : "border-border/70 bg-background/80 hover:border-primary/30"
                          }`}
                        >
                          <div className="text-sm font-semibold">{project.name}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {project.id} · {project.defaultBranch}
                          </div>
                          <div
                            className="mt-1 truncate text-xs text-muted-foreground"
                            title={project.repoPath}
                          >
                            {project.repoPath}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="h-full border-border/70 bg-card/80">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Conversations</CardTitle>
                  <Badge variant="secondary">{conversations.length}</Badge>
                </div>
                <CardDescription>Worktree sessions grouped by branch</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <form className="space-y-3" onSubmit={handleCreateConversation}>
                  <div className="space-y-1">
                    <label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Conversation title
                    </label>
                    <input
                      value={newConversationTitle}
                      onChange={(event) => setNewConversationTitle(event.target.value)}
                      placeholder="UI polish"
                      className="w-full rounded-xl border border-border/70 bg-background/80 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!activeProject || creatingConversation}
                    className="w-full rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {creatingConversation ? "Starting..." : "Start conversation"}
                  </button>
                  {conversationError ? (
                    <div className="rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-foreground">
                      {conversationError}
                    </div>
                  ) : null}
                  {!activeProject ? (
                    <div className="rounded-xl border border-dashed border-border/60 p-3 text-xs text-muted-foreground">
                      Select a project to start a conversation.
                    </div>
                  ) : null}
                </form>

                {conversations.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
                    No conversations yet.
                  </div>
                ) : (
                  conversations.map((conversation) => (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => setSelectedConversationId(conversation.id)}
                      className={cn(
                        "w-full rounded-xl border px-3 py-3 text-left transition",
                        conversation.id === selectedConversationId
                          ? "border-primary/60 bg-primary/10"
                          : "border-border/70 bg-background/80 hover:border-primary/30"
                      )}
                    >
                      <div className="text-sm font-semibold">
                        {conversation.title || conversation.id}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {conversation.id} · {formatTime(conversation.updatedAt)}
                      </div>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-6">
            <Card className="border-border/70 bg-card/80">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <CardTitle>
                      {selectedConversation?.title || selectedConversation?.id || "Select a conversation"}
                    </CardTitle>
                    <CardDescription>
                      {selectedConversation
                        ? `Base: ${selectedConversation.baseRef} · Branch: ${selectedConversation.branch}`
                        : "Pick a conversation to inspect sessions."}
                    </CardDescription>
                  </div>
                  <Badge>{status}</Badge>
                </div>
              </CardHeader>
            </Card>

            <div className="grid gap-6 xl:grid-cols-[260px_1fr]">
              <Card className="border-border/70 bg-card/80">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Sessions</CardTitle>
                    <Badge variant="secondary">{sessions.length}</Badge>
                  </div>
                  <CardDescription>Pick a session to read logs</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {sessions.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
                      No sessions yet.
                    </div>
                  ) : (
                    sessions.map((session) => (
                      <button
                        key={session.id}
                        type="button"
                        onClick={() => setSelectedSessionId(session.id)}
                        className={cn(
                          "w-full rounded-xl border px-3 py-3 text-left transition",
                          session.id === selectedSessionId
                            ? "border-primary/60 bg-primary/10"
                            : "border-border/70 bg-background/80 hover:border-primary/30"
                        )}
                      >
                        <div className="text-sm font-semibold">
                          {session.title || session.id}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {session.id} · {formatTime(session.updatedAt)}
                        </div>
                      </button>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-card/80">
                <CardHeader>
                  <CardTitle>Session Logs</CardTitle>
                  <CardDescription>Transcript and SDK events</CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="transcript">
                    <TabsList>
                      <TabsTrigger value="transcript">Transcript</TabsTrigger>
                      <TabsTrigger value="events">Events</TabsTrigger>
                    </TabsList>
                    <TabsContent value="transcript">
                      <div className="max-h-[420px] space-y-3 overflow-auto rounded-2xl border border-border/70 bg-background/70 p-4 text-sm">
                        {transcript.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-border/60 p-4 text-muted-foreground">
                            No transcript entries yet.
                          </div>
                        ) : (
                          transcript.map((entry, index) => (
                            <div
                              key={`${entry.role ?? "entry"}-${index}`}
                              className="rounded-xl border border-border/60 bg-card/90 p-3"
                            >
                              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                                {entry.role ?? "entry"}
                              </div>
                              <div className="mt-2 whitespace-pre-wrap font-mono text-xs text-foreground">
                                {entry.content ?? JSON.stringify(entry, null, 2)}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </TabsContent>
                    <TabsContent value="events">
                      <div className="max-h-[420px] space-y-3 overflow-auto rounded-2xl border border-border/70 bg-background/70 p-4 text-sm">
                        {events.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-border/60 p-4 text-muted-foreground">
                            No events yet.
                          </div>
                        ) : (
                          events.map((entry, index) => (
                            <div
                              key={`event-${index}`}
                              className="rounded-xl border border-border/60 bg-card/90 p-3"
                            >
                              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                                {(entry as { type?: string }).type ?? "event"}
                              </div>
                              <pre className="mt-2 whitespace-pre-wrap font-mono text-xs text-foreground">
                                {JSON.stringify(entry, null, 2)}
                              </pre>
                            </div>
                          ))
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
