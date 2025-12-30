"use client";

import { useQuery } from "@tanstack/react-query";
import type { BrowseResult } from "@/lib/types/api";

export function useFilesystem(path?: string) {
  return useQuery({
    queryKey: ["filesystem", path],
    queryFn: async (): Promise<BrowseResult> => {
      const url = path
        ? `/api/filesystem/browse?path=${encodeURIComponent(path)}`
        : "/api/filesystem/browse";
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to browse directory");
      }
      return res.json();
    },
    staleTime: 0, // Filesystem changes frequently
    placeholderData: (previousData) => previousData, // Keep old data while loading new
  });
}
