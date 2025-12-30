"use client";

import Link from "next/link";
import { mockProjects } from "@/lib/data/mock";
import { Folder, Zap, Circle, ChevronRight, Command, Search } from "lucide-react";

export default function ProjectListPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card">
        <div className="flex h-12 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-6 h-6 rounded bg-primary text-primary-foreground">
              <Zap className="h-3.5 w-3.5" />
            </div>
            <span className="font-semibold text-sm">Maestro</span>
          </div>
          <div className="flex items-center gap-1">
            <button className="h-8 px-3 rounded-md text-xs text-muted-foreground hover:bg-secondary flex items-center gap-2">
              <Search className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-border bg-secondary px-1.5 font-mono text-[10px] text-muted-foreground">
                <Command className="h-2.5 w-2.5" />K
              </kbd>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto p-4">
        <div className="mb-6">
          <h1 className="text-lg font-semibold">Projects</h1>
          <p className="text-sm text-muted-foreground">Select a project to view swarms and sessions</p>
        </div>
        
        <div className="border border-border rounded-md overflow-hidden divide-y divide-border">
          {mockProjects.map((project) => (
            <Link 
              key={project.id} 
              href={`/project/${project.id}`}
              className="flex items-center gap-3 px-3 py-2.5 hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-md bg-secondary">
                <Folder className="h-4 w-4 text-muted-foreground" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{project.name}</span>
                  {project.activeSwarms > 0 && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-status-success status-success">
                      <Circle className="h-1.5 w-1.5 fill-current" />
                      {project.activeSwarms} active
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground font-mono truncate">{project.path}</p>
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {project.inProgress > 0 && (
                  <span className="hidden sm:flex items-center gap-1">
                    <Circle className="h-1.5 w-1.5 fill-warning text-warning" />
                    {project.inProgress} in progress
                  </span>
                )}
                <span className="hidden sm:block">{project.lastActivity}</span>
                <ChevronRight className="h-4 w-4" />
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
