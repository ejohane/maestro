import { NextResponse } from "next/server";
import * as fs from "fs/promises";
import * as path from "path";
import { configService } from "@/lib/services/config";

const HIDDEN_PATTERNS = [
  /^\./,                 // Hidden dirs (., .git, .config, etc)
  /^node_modules$/,
  /^__pycache__$/,
  /^vendor$/,
  /^\.?venv$/,
  /^\.next$/,           // Next.js build output
  /^dist$/,             // Common build output
  /^build$/,            // Common build output
  /^target$/,           // Rust/Maven build output
  /^coverage$/,         // Test coverage
  /^\.nyc_output$/,     // NYC coverage
];

function shouldHide(name: string): boolean {
  return HIDDEN_PATTERNS.some(pattern => pattern.test(name));
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Filesystem timeout")), ms)
  );
  return Promise.race([promise, timeout]);
}

interface Directory {
  name: string;
  path: string;
  isGitRepo: boolean;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let targetPath = searchParams.get("path");
    
    // Default path logic
    if (!targetPath) {
      const devPath = path.join(configService.getHomeDir(), "dev");
      try {
        await withTimeout(fs.access(devPath), 5000);
        targetPath = devPath;
      } catch {
        targetPath = configService.getHomeDir();
      }
    } else {
      // Convert display path to absolute if needed
      targetPath = configService.toAbsolutePath(targetPath);
    }
    
    // Security check: must be within home
    if (!configService.isWithinHome(targetPath)) {
      return NextResponse.json(
        { error: "Access denied: path outside home directory" },
        { status: 403 }
      );
    }
    
    // Validate path exists and is directory
    try {
      const stat = await withTimeout(fs.stat(targetPath), 5000);
      if (!stat.isDirectory()) {
        return NextResponse.json(
          { error: "Path is not a directory" },
          { status: 400 }
        );
      }
    } catch (err) {
      if (err instanceof Error && err.message === "Filesystem timeout") {
        return NextResponse.json(
          { error: "Filesystem timeout" },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { error: "Path does not exist" },
        { status: 404 }
      );
    }
    
    // Read directory entries
    let entries: string[];
    try {
      entries = await withTimeout(fs.readdir(targetPath), 5000);
    } catch (err) {
      if (err instanceof Error && err.message === "Filesystem timeout") {
        return NextResponse.json(
          { error: "Filesystem timeout" },
          { status: 500 }
        );
      }
      throw err;
    }
    
    // Filter and process directories
    const directories: Directory[] = [];
    
    for (const entry of entries) {
      // Skip hidden entries
      if (shouldHide(entry)) continue;
      
      const entryPath = path.join(targetPath, entry);
      
      try {
        const stat = await fs.stat(entryPath);
        if (!stat.isDirectory()) continue;
        
        // Check if symlink resolves within home
        try {
          const realPath = await fs.realpath(entryPath);
          if (!configService.isWithinHome(realPath)) continue;
        } catch {
          // Skip broken symlinks
          continue;
        }
        
        // Check for .git subdirectory
        let isGitRepo = false;
        try {
          const gitPath = path.join(entryPath, ".git");
          await fs.access(gitPath);
          isGitRepo = true;
        } catch {
          // Not a git repo
        }
        
        directories.push({
          name: entry,
          path: entryPath,
          isGitRepo,
        });
      } catch {
        // Skip entries we can't access (permission denied, etc)
        continue;
      }
    }
    
    // Sort alphabetically (case-insensitive)
    directories.sort((a, b) => 
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );
    
    // Compute parent/canGoUp
    const parent = configService.getParentPath(targetPath);
    const canGoUp = parent !== null;
    
    return NextResponse.json({
      currentPath: targetPath,
      displayPath: configService.toDisplayPath(targetPath),
      parent,
      canGoUp,
      directories,
    });
  } catch (error) {
    console.error("Failed to browse filesystem:", error);
    return NextResponse.json(
      { error: "Failed to browse directory" },
      { status: 500 }
    );
  }
}
