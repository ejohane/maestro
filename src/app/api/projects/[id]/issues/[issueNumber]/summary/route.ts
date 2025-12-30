import { openCodeService } from "@/lib/services/opencode"
import { configService } from "@/lib/services/config"
import { NextResponse } from "next/server"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; issueNumber: string }> }
) {
  const { id } = await params
  const { sessionId } = await request.json()

  if (!sessionId) {
    return NextResponse.json({ error: "Session ID is required" }, { status: 400 })
  }

  const project = await configService.getProject(id)
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 })
  }

  try {
    const summary = await openCodeService.generateSummary(project.path, sessionId)
    return NextResponse.json({ summary })
  } catch (error) {
    console.error("Failed to generate summary:", error)
    return NextResponse.json(
      { error: "Failed to generate summary" },
      { status: 500 }
    )
  }
}
