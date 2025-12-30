// Mock data for MVP prototype

export interface Project {
  id: string;
  name: string;
  path: string;
  activeSwarms: number;
  inProgress: number;
  lastActivity: string;
}

export interface Epic {
  id: string;
  title: string;
  description: string;
  state: "ideating" | "planned" | "in_progress" | "closed";
  githubIssue?: string;
  branch?: string;
  subtasks: Subtask[];
  createdAt: string;
}

export interface Subtask {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "blocked" | "done" | "failed";
  files: string[];
  assignedAgent?: string;
}

export interface Agent {
  id: string;
  name: string;
  status: "idle" | "working" | "blocked" | "completed" | "failed";
  currentTask?: string;
  lastMessage?: string;
  progress: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface Session {
  id: string;
  title: string;
  lastMessage: string;
  updatedAt: string;
}

// Mock Projects
export const mockProjects: Project[] = [
  {
    id: "proj-1",
    name: "opencode-client",
    path: "~/dev/opencode-client",
    activeSwarms: 1,
    inProgress: 2,
    lastActivity: "2 min ago",
  },
  {
    id: "proj-2",
    name: "api-gateway",
    path: "~/dev/api-gateway",
    activeSwarms: 0,
    inProgress: 1,
    lastActivity: "1 hour ago",
  },
  {
    id: "proj-3",
    name: "mobile-app",
    path: "~/dev/mobile-app",
    activeSwarms: 0,
    inProgress: 0,
    lastActivity: "3 days ago",
  },
];

// Mock Epics for opencode-client
export const mockEpics: Epic[] = [
  {
    id: "epic-1",
    title: "Add user authentication flow",
    description: "Implement OAuth2 authentication with GitHub and Google providers",
    state: "in_progress",
    githubIssue: "#42",
    branch: "feature/auth-flow",
    subtasks: [
      { id: "task-1", title: "Set up OAuth2 client config", status: "done", files: ["src/lib/auth.ts"] },
      { id: "task-2", title: "Create login page UI", status: "done", files: ["src/app/login/page.tsx"] },
      { id: "task-3", title: "Implement GitHub provider", status: "in_progress", files: ["src/lib/providers/github.ts"], assignedAgent: "agent-1" },
      { id: "task-4", title: "Implement Google provider", status: "in_progress", files: ["src/lib/providers/google.ts"], assignedAgent: "agent-2" },
      { id: "task-5", title: "Add session middleware", status: "pending", files: ["src/middleware.ts"] },
      { id: "task-6", title: "Create protected route wrapper", status: "pending", files: ["src/components/ProtectedRoute.tsx"] },
    ],
    createdAt: "2024-01-15",
  },
  {
    id: "epic-2",
    title: "Refactor database layer",
    description: "Migrate from raw SQL to Prisma ORM for better type safety",
    state: "in_progress",
    githubIssue: "#38",
    branch: "feature/prisma-migration",
    subtasks: [
      { id: "task-7", title: "Initialize Prisma schema", status: "done", files: ["prisma/schema.prisma"] },
      { id: "task-8", title: "Migrate user model", status: "blocked", files: ["src/models/user.ts"], assignedAgent: "agent-3" },
    ],
    createdAt: "2024-01-14",
  },
  {
    id: "epic-3",
    title: "API rate limiting",
    description: "Add rate limiting to prevent API abuse",
    state: "planned",
    githubIssue: "#45",
    branch: "feature/rate-limiting",
    subtasks: [
      { id: "task-9", title: "Set up Redis connection", status: "pending", files: ["src/lib/redis.ts"] },
      { id: "task-10", title: "Create rate limit middleware", status: "pending", files: ["src/middleware/rateLimit.ts"] },
      { id: "task-11", title: "Add rate limit headers", status: "pending", files: ["src/lib/headers.ts"] },
    ],
    createdAt: "2024-01-16",
  },
  {
    id: "epic-4",
    title: "Dark mode support",
    description: "Exploring how to implement system-aware dark mode with manual toggle",
    state: "ideating",
    subtasks: [],
    createdAt: "2024-01-17",
  },
  {
    id: "epic-5",
    title: "WebSocket notifications",
    description: "Real-time notifications via WebSocket connection",
    state: "closed",
    githubIssue: "#35",
    branch: "feature/websocket-notifs",
    subtasks: [
      { id: "task-12", title: "Set up WebSocket server", status: "done", files: ["src/server/ws.ts"] },
      { id: "task-13", title: "Create notification client", status: "done", files: ["src/lib/notifications.ts"] },
    ],
    createdAt: "2024-01-10",
  },
];

// Mock Agents for active swarm
export const mockAgents: Agent[] = [
  {
    id: "agent-1",
    name: "GreenFox",
    status: "working",
    currentTask: "Implement GitHub provider",
    lastMessage: "Adding OAuth callback handler...",
    progress: 65,
  },
  {
    id: "agent-2",
    name: "BlueLake",
    status: "working",
    currentTask: "Implement Google provider",
    lastMessage: "Configuring Google OAuth scopes...",
    progress: 40,
  },
  {
    id: "agent-3",
    name: "RedStone",
    status: "blocked",
    currentTask: "Migrate user model",
    lastMessage: "Error: Cannot find migration file for users table",
    progress: 20,
  },
];

// Mock chat messages for ideation
export const mockIdeationChat: ChatMessage[] = [
  {
    id: "msg-1",
    role: "user",
    content: "I want to add dark mode to the app. What's the best approach?",
    timestamp: "10:30 AM",
  },
  {
    id: "msg-2",
    role: "assistant",
    content: "Great question! There are a few approaches for dark mode:\n\n1. **CSS Variables + class toggle** - Simple, works everywhere\n2. **Tailwind dark mode** - Built-in support with `dark:` prefix\n3. **CSS media query only** - System preference, no toggle\n\nSince you're using Tailwind, I'd recommend option 2 with a toggle that also respects system preference. Would you like me to break down how that would work?",
    timestamp: "10:31 AM",
  },
  {
    id: "msg-3",
    role: "user",
    content: "Yes, let's use Tailwind. Should the preference be persisted?",
    timestamp: "10:32 AM",
  },
  {
    id: "msg-4",
    role: "assistant",
    content: "Definitely! Here's my recommendation:\n\n1. Store preference in localStorage\n2. On load, check localStorage first, fall back to system preference\n3. Apply a `dark` class to `<html>` element\n4. Use `dark:` variants in Tailwind\n\nFor the toggle UI, we could add it to the header with a sun/moon icon. Want me to also consider how this affects the existing color scheme?",
    timestamp: "10:33 AM",
  },
];

// Mock solo sessions
export const mockSoloSessions: Session[] = [
  {
    id: "session-1",
    title: "Fix pagination bug",
    lastMessage: "The offset was off by one, fixed it.",
    updatedAt: "Yesterday",
  },
  {
    id: "session-2",
    title: "Refactor utils",
    lastMessage: "Moved all date formatting to a single module.",
    updatedAt: "2 days ago",
  },
  {
    id: "session-3",
    title: "Update dependencies",
    lastMessage: "All packages updated, tests passing.",
    updatedAt: "1 week ago",
  },
  {
    id: "session-4",
    title: "Debug API response",
    lastMessage: "Found the issue - missing null check on response.data",
    updatedAt: "1 week ago",
  },
  {
    id: "session-5",
    title: "Add logging middleware",
    lastMessage: "Implemented request/response logging with correlation IDs",
    updatedAt: "2 weeks ago",
  },
  {
    id: "session-6",
    title: "Performance optimization",
    lastMessage: "Reduced bundle size by 40% using dynamic imports",
    updatedAt: "2 weeks ago",
  },
];
