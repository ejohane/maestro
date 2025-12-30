import type { ChatMessage } from "@/lib/hooks/useChatSession";

/**
 * AI Elements message format with parts array structure
 */
export interface AIElementsMessage {
  id: string;
  role: "user" | "assistant";
  parts: Array<{ type: "text"; text: string }>;
}

/**
 * Convert a single ChatMessage to AI Elements format
 */
export function toAIElementsMessage(msg: ChatMessage): AIElementsMessage {
  return {
    id: msg.id,
    role: msg.role,
    parts: [{ type: "text", text: msg.content }],
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
