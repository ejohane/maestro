"use client";

import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCw } from "lucide-react";

interface SlashCommand {
  cmd: string;
  desc: string;
  icon?: React.ReactNode;
}

const commands: SlashCommand[] = [
  {
    cmd: "/improve_beads",
    desc: "Holistically improve the current plan",
    icon: <Sparkles className="h-3 w-3" />,
  },
  {
    cmd: "/turn_gh_issue_into_beads",
    desc: "Re-generate task breakdown",
    icon: <RefreshCw className="h-3 w-3" />,
  },
];

interface SlashCommandSuggestionsProps {
  onSelect: (command: string) => void;
  disabled?: boolean;
}

export function SlashCommandSuggestions({
  onSelect,
  disabled = false,
}: SlashCommandSuggestionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {commands.map((command) => (
        <Button
          key={command.cmd}
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1.5 px-2"
          onClick={() => onSelect(command.cmd)}
          disabled={disabled}
          title={command.desc}
        >
          {command.icon}
          <span className="font-mono">{command.cmd}</span>
        </Button>
      ))}
    </div>
  );
}
