import type { ChatMessage, MessagePart, TextPart, ReasoningPart, ToolPart } from "@/lib/hooks/useChatSession";

/**
 * AI Elements message format with parts array structure
 * Now supports text, reasoning, and tool parts
 */
export interface AIElementsMessage {
  id: string;
  role: "user" | "assistant";
  parts: MessagePart[];
}

// Re-export part types for convenience
export type { MessagePart, TextPart, ReasoningPart, ToolPart };

/**
 * Convert a single ChatMessage to AI Elements format
 */
export function toAIElementsMessage(msg: ChatMessage): AIElementsMessage {
  return {
    id: msg.id,
    role: msg.role,
    parts: msg.parts,
  };
}

/**
 * Convert an array of ChatMessages to AI Elements format
 */
export function toAIElementsMessages(
  messages: ChatMessage[]
): AIElementsMessage[] {
  return messages.map(toAIElementsMessage);
}
