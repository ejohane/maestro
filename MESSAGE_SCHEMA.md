# Message Schema (Structured Parts)

This document defines the canonical message schema aligned with AI SDK UIMessage parts. It is the contract for server streaming, transcript storage, and client rendering.

## Canonical message shape

```json
{
  "id": "msg_123",
  "role": "assistant",
  "createdAt": "2026-02-02T12:34:56.000Z",
  "content": "Hello world",
  "parts": [
    { "type": "text", "text": "Hello world" }
  ],
  "metadata": {
    "requestId": "req_123"
  }
}
```

Fields:
- `role`: `user` | `assistant` | `system` | `tool`.
- `parts`: optional array of structured parts. This is the canonical representation.
- `content`: optional legacy string view (see mapping rules).
- `metadata`: optional free-form object for message-level metadata.

## Transcript entry shape

Transcript entries in `transcript.ndjson` use the message shape plus storage metadata:

```json
{
  "ts": "2026-02-02T12:34:56.000Z",
  "sessionId": "s_abc123",
  "conversationId": "c_def456",
  "role": "user",
  "content": "Run tests",
  "parts": [
    { "type": "text", "text": "Run tests" }
  ]
}
```

## Part types

### Text part

```json
{ "type": "text", "text": "Hello" }
```

### Reasoning part

```json
{ "type": "reasoning", "text": "Short chain-of-thought summary." }
```

### Tool call part (with approvals)

```json
{
  "type": "tool",
  "callId": "tool_123",
  "name": "bash",
  "input": { "command": "bun run test" },
  "status": "pending",
  "approval": {
    "status": "approved",
    "by": "user",
    "reason": "User requested",
    "ts": "2026-02-02T12:34:56.000Z"
  }
}
```

### Tool result part

```json
{
  "type": "tool_result",
  "callId": "tool_123",
  "name": "bash",
  "output": { "exitCode": 0, "stdout": "..." },
  "isError": false
}
```

### Sources part (citations)

```json
{
  "type": "sources",
  "sources": [
    {
      "id": "src_1",
      "title": "README",
      "url": "https://example.com/readme",
      "snippet": "This repo...",
      "locator": "README.md#L1"
    }
  ]
}
```

### File part (attachment references)

```json
{
  "type": "file",
  "file": {
    "id": "file_123",
    "name": "report.pdf",
    "path": "reports/report.pdf",
    "mimeType": "application/pdf",
    "size": 18432,
    "source": "upload"
  }
}
```

### Data-* parts

Any part with a type that starts with `data-` is reserved for structured payloads used by clients:

```json
{
  "type": "data-task",
  "data": { "status": "in_progress", "title": "Run tests" },
  "label": "Task update"
}
```

## Streaming events (SSE)

The web client streams assistant responses via the SSE endpoint:

`POST /api/conversations/{conversationId}/sessions/{sessionId}/chat/stream`

Events are emitted as `event:` + `data:` pairs. The client accepts both `message_part_updated` and
`message.part.updated` for backward compatibility.

### Event: `message_start`

```json
{ "id": "msg_abc", "role": "assistant" }
```

### Event: `message_part_updated`

```json
{
  "id": "msg_abc",
  "partType": "text",
  "delta": "more text",
  "part": { "type": "text", "id": "part_1", "text": "Hello world" }
}
```

Notes:
- `part` is the merged, latest view of the part.
- `delta` is passed through to the client for incremental updates.
- Include a stable `id` or `index` on parts to ensure deterministic updates.

### Event: `message_delta`

```json
{ "delta": "more text" }
```

Used as a fast path for updating the text part and message content when streaming.

### Event: `message_end`

```json
{
  "id": "msg_abc",
  "content": "Final response",
  "parts": [{ "type": "text", "text": "Final response" }]
}
```

### Event: `error`

```json
{ "message": "Streaming failed." }
```

## Client rendering and part mapping

The web UI builds its rendering model from message parts in `apps/web/src/features/workbench/message-entries.ts` and renders them in `apps/web/src/features/workbench/views/chat-view.tsx`:

- Text is rendered from `getTextFromParts(parts)` (fallbacks to `content`).
- `reasoning` parts are grouped and shown in the assistant reasoning panel.
- `tool` and `tool_result` parts are shown in the tool output section.
- `file` parts render as attachments.
- `sources` parts are flattened into citations and injected into markdown.
- `data-checkpoint` parts become checkpoint markers.
- `data-plan` / `data-plans` parts become plan cards.
- `data-task` / `data-tasks` parts become task lists.
- `data-queue` / `data-queues` parts become queue views.
- `data-branch` / `data-branches` (or `metadata.branches`) provide alternative branches.

Core helpers that normalize and merge streaming parts live in `apps/web/src/lib/messages.ts`.

## Extending part rendering

When introducing a new structured part:

1. Pick a unique `type` (prefer the `data-*` namespace for app-specific payloads).
2. Ensure the server streams and stores the part with a stable `id` or `index` to support updates.
3. Add a selector/mapping in `apps/web/src/features/workbench/message-entries.ts` to translate the new part into a render model.
4. Render the new model in `apps/web/src/features/workbench/views/chat-view.tsx` alongside other message sections.
5. Update this document with the new part shape and any streaming notes.

## Legacy mapping rules

- If `content` is present and `parts` is missing or empty, treat the message as a single text part:
  - `parts = [{ type: "text", text: content }]`.
- If `parts` is present and `content` is missing, derive `content` by concatenating only `text` parts in order.
- If both `content` and `parts` are present, `parts` is the source of truth. `content` should match the concatenated `text` parts.
- When building a text-only history view (system prompt or UI fallback), use `content` if present, otherwise the derived text.
- Unknown or missing `role` values default to `user` for legacy entries.

## Legacy compatibility and migration strategy

Legacy sessions that only stored `content` remain functional via **on-read normalization**:

- When reading transcripts or streaming history, missing `parts` are synthesized from `content`.
- When `parts` exist without `content`, the server derives `content` from text parts.
- New writes always persist both `content` and `parts` to keep mixed-format sessions consistent.

Mixed-format sessions are supported:

- `parts` are the source of truth for structured rendering.
- `content` is treated as a text-only fallback and is derived when absent.
- If `content` and text-part concatenation disagree, the API logs a migration warning and favors `parts`.

Telemetry/logging:

- API responses log warnings when a transcript entry is missing both `content` and `parts`, or when `content` disagrees with text-part concatenation.
- These warnings are intended to surface data that should be backfilled by a future batch migration.
