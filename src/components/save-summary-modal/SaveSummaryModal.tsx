"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

interface SaveSummaryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  issueNumber: number
  sessionId: string | null
  onSuccess?: () => void
}

export function SaveSummaryModal({
  open,
  onOpenChange,
  projectId,
  issueNumber,
  sessionId,
  onSuccess,
}: SaveSummaryModalProps) {
  const [summary, setSummary] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [isPosting, setIsPosting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Generate summary when modal opens
  useEffect(() => {
    if (open && sessionId) {
      generateSummary()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sessionId])

  const generateSummary = async () => {
    if (!sessionId) return
    
    setIsGenerating(true)
    setError(null)
    
    try {
      const response = await fetch(
        `/api/projects/${projectId}/issues/${issueNumber}/summary`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        }
      )
      
      if (!response.ok) throw new Error("Failed to generate summary")
      
      const { summary: generatedSummary } = await response.json()
      setSummary(generatedSummary || "No summary could be generated.")
    } catch (err) {
      setError("Failed to generate summary. Please try again.")
      console.error(err)
    } finally {
      setIsGenerating(false)
    }
  }

  const handlePost = async () => {
    if (!summary.trim()) return
    
    setIsPosting(true)
    setError(null)
    
    // Format the comment with footer
    const formattedBody = `## Discussion Summary

${summary}

---
*Generated from Maestro discussion on ${new Date().toLocaleDateString()}*`
    
    try {
      const response = await fetch(
        `/api/projects/${projectId}/issues/${issueNumber}/comment`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: formattedBody }),
        }
      )
      
      if (!response.ok) throw new Error("Failed to post comment")
      
      onSuccess?.()
      onOpenChange(false)
      setSummary("")
    } catch (err) {
      setError("Failed to post comment. Please try again.")
      console.error(err)
    } finally {
      setIsPosting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Save Discussion Summary</DialogTitle>
          <DialogDescription>
            Generate a summary of your discussion to post as a GitHub comment.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isGenerating ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Generating summary...</span>
            </div>
          ) : (
            <div className="space-y-2">
              <label htmlFor="summary" className="text-sm font-medium">
                Summary (editable)
              </label>
              <textarea
                id="summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className="w-full min-h-[200px] p-3 border rounded-md text-sm font-mono bg-background resize-y"
                placeholder="Summary will appear here..."
              />
            </div>
          )}
          
          {error && (
            <p className="text-sm text-destructive mt-2">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handlePost}
            disabled={isGenerating || isPosting || !summary.trim()}
          >
            {isPosting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Posting...
              </>
            ) : (
              "Post to Issue"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
