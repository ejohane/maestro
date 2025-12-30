import { spawn } from "child_process"
import { configService } from "@/lib/services/config"
import { NextResponse } from "next/server"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; issueNumber: string }> }
) {
  const { id, issueNumber } = await params
  
  let body: string
  try {
    const json = await request.json()
    body = json.body
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    )
  }

  if (!body || typeof body !== "string") {
    return NextResponse.json(
      { error: "Comment body is required" },
      { status: 400 }
    )
  }

  const project = await configService.getProject(id)
  if (!project) {
    return NextResponse.json(
      { error: "Project not found" },
      { status: 404 }
    )
  }

  try {
    // Use stdin approach for safer shell escaping
    // Write body to stdin of gh command using --body-file -
    await new Promise<void>((resolve, reject) => {
      const proc = spawn("gh", ["issue", "comment", issueNumber, "--body-file", "-"], {
        cwd: project.path,
        stdio: ["pipe", "pipe", "pipe"]
      })
      
      let stderr = ""
      proc.stderr.on("data", (data) => {
        stderr += data.toString()
      })
      
      proc.on("close", (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(stderr || `gh exited with code ${code}`))
        }
      })
      
      proc.on("error", reject)
      
      // Write body to stdin and close
      proc.stdin.write(body)
      proc.stdin.end()
    })

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    console.error("Failed to post comment:", error)
    return NextResponse.json(
      { error: "Failed to post comment to GitHub" },
      { status: 500 }
    )
  }
}
