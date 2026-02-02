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
