---
name: span-file-export
description: Use file-based span/log export for AI consumption. Where it lives, how to enable/clear, record format for Node and Web. Use when enabling span file dump, debugging traces for AI, or configuring local observability.
---

# Span & Log File Export

Local OTLP export to `~/.sf/vscode-spans/` for AI consumers. Spans and log records interleaved in one JSONL file.

## Settings Required

| Setting | Default | Purpose |
|---------|---------|---------|
| `salesforcedx-vscode-salesforcedx.enableFileTraces` | `false` | Enables file capture (spans + logs) |
| `salesforcedx-vscode-salesforcedx.logLevel` | `error` | Minimum log level for exported records. Set to `info` or `debug` to see most logs. |
| `SF_LOG_LEVEL` env var | — | Fallback when VS Code setting unset (`fatal` maps to `error`) |

Reload the window after changing — the SDK layer is built at activation time.

## Where It Lives

All records in one directory: `~/.sf/vscode-spans/`

Filename pattern: `{ISO-timestamp}.jsonl` (e.g., `2026-05-22T15-33-01-398Z.jsonl`)

Find latest: `ls -lt ~/.sf/vscode-spans/ | head -1`

## Record Format

Each line is independent JSON. Discriminate on `"kind"` field.

### Spans (`kind: "span"`)

```jsonl
{"kind":"span","traceId":"abc123","spanId":"def456","parentSpanId":"","name":"ConnectionService.getConnection","spanKind":1,"startTimeUnixNano":"1779461510277547833","endTimeUnixNano":"1779461510278117291","attributes":{"orgId":"00D..."},"events":[],"links":[],"status":{"code":1,"message":""},"resource":{"attributes":{"extension.name":"salesforcedx-vscode-core","service.name":"salesforcedx-vscode-core"}},"instrumentationScope":{"name":"salesforcedx-vscode-core","version":"2026-03-02T01:00.304Z"}}
```

| Field | Notes |
|-------|-------|
| `parentSpanId: ""` | Root span (top of trace tree) |
| `status.code` | 1=OK, 2=ERROR |
| `spanKind` | OTEL SpanKind enum +1 (1=INTERNAL, 2=SERVER, 3=CLIENT) |
| `resource.attributes["extension.name"]` | Which extension emitted it |
| Duration (ms) | `(endTimeUnixNano - startTimeUnixNano) / 1_000_000` |

### Logs (`kind: "log"`)

```jsonl
{"kind":"log","timestamp":"1779463981397000000","severityText":"WARN","severityNumber":30000,"body":"UserIdNotFoundError: Could not determine user ID","traceId":"b4d710...","spanId":"706dfc...","attributes":{"fiberId":"#295"}}
```

| Field | Notes |
|-------|-------|
| `traceId` + `spanId` | Correlates to parent span active when log was emitted |
| `severityText` | INFO, WARN, ERROR (filtered by `logLevel` setting) |
| `body` | String or array (multiple log args) |
| `timestamp` | Nanoseconds since epoch |

Only log records at or above the configured `logLevel` are emitted.

## Enable (Desktop)

```json
{
  "salesforcedx-vscode-salesforcedx.enableFileTraces": true,
  "salesforcedx-vscode-salesforcedx.logLevel": "info"
}
```

## Enable (Web / run:web)

Web POSTs to local span file server (port 3003). Server must be running.

1. Start server: `npm run spans:server -w salesforcedx-vscode-services`
2. Add to `.esbuild-web-extra-settings.json` at repo root (gitignored):
   ```json
   { "salesforcedx-vscode-salesforcedx.enableFileTraces": true }
   ```
3. Run `npm run run:web -w packages/<extension>`

## Clear

`rm ~/.sf/vscode-spans/*`

## Trace Correlation

Logs reference the span that was active when they were emitted via `traceId` + `spanId`. To reconstruct an operation:

1. Find all spans with a given `traceId`
2. Build tree using `parentSpanId` → children
3. Find logs with the same `traceId` — they belong to the span matching their `spanId`
