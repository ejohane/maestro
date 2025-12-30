import { openCodeService } from "@/lib/services/opencode"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const healthy = await openCodeService.isHealthy()
    
    if (healthy) {
      return NextResponse.json({
        status: "healthy",
        url: process.env.OPENCODE_URL || "http://localhost:4096"
      })
    } else {
      return NextResponse.json({
        status: "unhealthy",
        error: "OpenCode server not responding"
      }, { status: 503 })
    }
  } catch (error) {
    return NextResponse.json({
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 503 })
  }
}
