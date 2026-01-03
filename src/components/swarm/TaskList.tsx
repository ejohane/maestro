"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Loader2, ListTodo } from "lucide-react";
import type { Bead } from "@/lib/services/beads";

interface TaskListProps {
  beads: Bead[];
}

const statusIcons: Record<string, React.ReactNode> = {
  closed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  in_progress: <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />,
  open: <Circle className="h-4 w-4 text-muted-foreground" />,
};

const statusVariants: Record<string, "default" | "secondary" | "outline"> = {
  closed: "secondary",
  in_progress: "default",
  open: "outline",
};

const statusText: Record<string, string> = {
  closed: "Completed",
  in_progress: "In Progress",
  open: "Pending",
};

export function TaskList({ beads }: TaskListProps) {
  const tasks = beads.filter((b) => b.type === "task");

  // Sort: in_progress first, then open, then closed
  const sortedTasks = [...tasks].sort((a, b) => {
    const priority: Record<string, number> = { in_progress: 0, open: 1, closed: 2 };
    return (priority[a.status] ?? 3) - (priority[b.status] ?? 3);
  });

  if (tasks.length === 0) {
    return (
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ListTodo className="h-4 w-4" />
            Tasks
          </CardTitle>
        </CardHeader>
        <CardContent className="py-4 text-center text-muted-foreground">
          <p>No tasks found for this epic.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ListTodo className="h-4 w-4" />
            Tasks
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {tasks.filter((t) => t.status === "closed").length}/{tasks.length} completed
          </span>
        </div>
      </CardHeader>
      <CardContent className="py-0 px-4 pb-4">
        <div className="space-y-2">
          {sortedTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center justify-between py-2 border-b last:border-b-0"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {statusIcons[task.status] || statusIcons.open}
                <span className="text-sm truncate">{task.title}</span>
              </div>
              <Badge variant={statusVariants[task.status] || "outline"} className="ml-2 shrink-0">
                {statusText[task.status] || task.status}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
