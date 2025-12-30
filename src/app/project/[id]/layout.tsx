"use client";

import { Sidebar } from "@/components/ui/sidebar";

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-background">
      {/* Left Sidebar */}
      <Sidebar />
      
      {/* Right Detail Panel */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
