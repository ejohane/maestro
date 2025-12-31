"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, GitBranch, Package, Brain } from "lucide-react"

interface StartPlanningModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  issueNumber: number
  issueTitle: string
  onConfirm: () => void
}

const PLANNING_STEPS = [
  {
    icon: GitBranch,
    title: "Create a git worktree",
    description: "Set up an isolated environment for safe, experimental changes",
  },
  {
    icon: Package,
    title: "Install dependencies",
    description: "Ensure the worktree has all required packages installed",
  },
  {
    icon: Brain,
    title: "Start AI planning session",
    description: "Break down the issue into actionable tasks with AI assistance",
  },
]

export function StartPlanningModal({
  open,
  onOpenChange,
  issueNumber,
  issueTitle,
  onConfirm,
}: StartPlanningModalProps) {
  const [isStarting, setIsStarting] = useState(false)

  const handleConfirm = () => {
    setIsStarting(true)
    onConfirm()
    // Note: We don't reset isStarting here because navigation will unmount the component
  }

  const handleOpenChange = (newOpen: boolean) => {
    // Don't allow closing while starting
    if (isStarting) return
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Start Planning for #{issueNumber}</DialogTitle>
          <DialogDescription className="pt-1">
            <span className="line-clamp-2">{issueTitle}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">
            Starting planning mode will:
          </p>
          <ol className="space-y-4">
            {PLANNING_STEPS.map((step, index) => (
              <li key={index} className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <step.icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {step.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isStarting}
          >
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isStarting}>
            {isStarting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Starting...
              </>
            ) : (
              "Start Planning"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
