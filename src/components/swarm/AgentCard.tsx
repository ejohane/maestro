"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Bot,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  ShieldQuestion,
} from "lucide-react";
import { PermissionRequest } from "./PermissionRequest";
import type { SwarmAgentState } from "@/lib/types/api";

interface AgentCardProps {
  agent: SwarmAgentState;
  onApprovePermission?: (permissionId: string) => void;
  onDenyPermission?: (permissionId: string) => void;
}

const statusIcons = {
  busy: <Loader2 className="h-4 w-4 animate-spin text-green-500" />,
  idle: <Clock className="h-4 w-4 text-blue-500" />,
  blocked: <ShieldQuestion className="h-4 w-4 text-orange-500" />,
  error: <AlertCircle className="h-4 w-4 text-red-500" />,
  completed: <CheckCircle className="h-4 w-4 text-green-500" />,
};

const statusVariants: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  busy: "default",
  idle: "secondary",
  blocked: "outline",
  error: "destructive",
  completed: "secondary",
};

export function AgentCard({
  agent,
  onApprovePermission,
  onDenyPermission,
}: AgentCardProps) {
  const [isExpanded, setIsExpanded] = useState(agent.status === "blocked");

  return (
    <Card className={agent.status === "blocked" ? "border-orange-500" : ""}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardHeader className="py-3 px-4">
          <CollapsibleTrigger className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium">{agent.title}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={statusVariants[agent.status]}>
                {statusIcons[agent.status]}
                <span className="ml-1 capitalize">{agent.status}</span>
              </Badge>
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </div>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0 px-4 pb-4">
            {agent.lastActivity && (
              <div className="text-sm text-muted-foreground mb-3">
                <span className="font-medium">Last activity:</span>{" "}
                {agent.lastActivity}
                {agent.lastActivityAt && (
                  <span className="text-xs ml-2">
                    ({new Date(agent.lastActivityAt).toLocaleTimeString()})
                  </span>
                )}
              </div>
            )}

            {agent.status === "blocked" && agent.pendingPermission && (
              <PermissionRequest
                permission={agent.pendingPermission}
                onApprove={() =>
                  onApprovePermission?.(agent.pendingPermission!.id)
                }
                onDeny={() => onDenyPermission?.(agent.pendingPermission!.id)}
              />
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
