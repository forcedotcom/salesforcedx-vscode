---
name: span-file-export
description: Use file-based span export for AI consumption. Where it lives, how to enable/clear, settings for Node and Web. Use when enabling span file dump, debugging traces for AI, or configuring local observability.
---

# Span File Export

Local span export to `~/.sf/vscode-spans/` for AI consumers. Simplified flat JSON Lines format.

## Choose One: OTLP vs File

- **OTLP** (`enableLocalTraces`): Grafana/Jaeger UI — for humans
- **File** (`enableFileTraces`): `.jsonl` on disk — for AI agents, Cursor

Use only one at a time.

## Where It Lives

All spans in one directory: `~/.sf/vscode-spans/`

| Prefix | Path pattern |
|--------|--------------|
| Node | `node-{extensionName}-{ISO-timestamp}.jsonl` |
| Web | `web-{extensionName}-{ISO-timestamp}.jsonl` |

Find latest: `ls -lt ~/.sf/vscode-spans/`

## Enable (Desktop)

Settings → search `enableFileTraces` → check, or:

```json
{ "salesforcedx-vscode-salesforcedx.enableFileTraces": true }
```

## Enable (Web / run:web)

Web POSTs to local span file server (port 3003). Server must be running.

1. Start server: `npm run spans:server -w salesforcedx-vscode-services`
2. Add to `.esbuild-web-extra-settings.json` at repo root (gitignored):

```json
{ "salesforcedx-vscode-salesforcedx.enableFileTraces": true }
```

3. Run `npm run run:web -w packages/<extension>`
4. If settings don't appear: `rm -rf packages/salesforcedx-vscode-services/.wireit packages/salesforcedx-vscode-services/dist`

`test:web` and `test:desktop` can auto-start the span file server via wireit service dep (when configured in script dependencies).

## Clear

`rm ~/.sf/vscode-spans/*` or `rm -rf ~/.sf/vscode-spans/`

## Format

Simplified flat JSON — one object per line:

```jsonl
{"name":"deploy","traceId":"abc","spanId":"def","parentSpanId":"","durationMs":1234,"status":"OK","startTime":"2026-02-25T10:30:00.000Z","attributes":{"componentCount":"5"}}
```

Parse with `JSON.parse` per line.
