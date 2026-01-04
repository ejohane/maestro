"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  Check,
  X,
  Terminal,
  FileEdit,
  Globe,
} from "lucide-react";
import type { PendingPermission } from "@/lib/types/api";

interface PermissionRequestProps {
  permission: PendingPermission;
  onApprove: () => void; // "once" - approve this time
  onApproveAlways?: () => void; // "always" - add to allowlist (optional)
  onDeny: () => void; // "reject" - deny action
  isResponding?: boolean;
}

// Icon mapping for permission types
const permissionIcons: Record<string, React.ReactNode> = {
  bash: <Terminal className="h-4 w-4" />,
  edit: <FileEdit className="h-4 w-4" />,
  write: <FileEdit className="h-4 w-4" />,
  webfetch: <Globe className="h-4 w-4" />,
  default: <Shield className="h-4 w-4" />,
};

export function PermissionRequest({
  permission,
  onApprove,
  onApproveAlways,
  onDeny,
  isResponding = false,
}: PermissionRequestProps) {
  const [responding, setResponding] = useState<
    "once" | "always" | "reject" | null
  >(null);

  const handleApprove = () => {
    setResponding("once");
    onApprove();
  };

  const handleApproveAlways = () => {
    setResponding("always");
    onApproveAlways?.();
  };

  const handleDeny = () => {
    setResponding("reject");
    onDeny();
  };

  const icon = permissionIcons[permission.type] || permissionIcons.default;

  return (
    <Card className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-orange-100 dark:bg-orange-900">
              {icon}
            </div>
            <div>
              <h4 className="font-medium text-sm">{permission.title}</h4>
              <Badge variant="outline" className="mt-0.5 text-xs">
                {permission.type}
              </Badge>
            </div>
          </div>
        </div>

        {/* Pattern/command being requested */}
        {permission.pattern && (
          <div className="bg-background rounded-md p-2 font-mono text-xs overflow-x-auto">
            {permission.pattern}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleApprove}
            disabled={isResponding || responding !== null}
            className="flex-1"
          >
            <Check className="h-4 w-4 mr-1" />
            {responding === "once" ? "Approving..." : "Approve"}
          </Button>

          {onApproveAlways && (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleApproveAlways}
              disabled={isResponding || responding !== null}
            >
              {responding === "always" ? "..." : "Always"}
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={handleDeny}
            disabled={isResponding || responding !== null}
            className="flex-1"
          >
            <X className="h-4 w-4 mr-1" />
            {responding === "reject" ? "Denying..." : "Deny"}
          </Button>
        </div>

        {/* Timestamp */}
        <p className="text-xs text-muted-foreground">
          Requested {new Date(permission.requestedAt).toLocaleTimeString()}
        </p>
      </CardContent>
    </Card>
  );
}
