---
name: span-file-export
description: Use file-based span/log export for AI consumption. Where it lives, how to enable/clear, record format for Node and Web. Use when enabling span file dump, debugging traces for AI, or configuring local observability.
---

# Span & Log File Export

Local OTLP export to `~/.sf/vscode-spans/` for AI consumers. Spans + log records interleaved in one JSONL file.

## Settings

| Setting | Default | Purpose |
|---------|---------|---------|
| `salesforcedx-vscode-salesforcedx.enableFileTraces` | `false` | Enable file capture (spans + logs) |
| `salesforcedx-vscode-salesforcedx.logLevel` | `error` | Min log level exported. `info`/`debug` for most logs. |
| `SF_LOG_LEVEL` env var | — | Fallback when setting unset (`fatal`→`error`) |

Reload window after changing — SDK layer builds at activation.

## Location

Dir: `~/.sf/vscode-spans/`. Filename: `{ISO-timestamp}.jsonl` (e.g. `2026-05-22T15-33-01-398Z.jsonl`).

Latest: `ls -lt ~/.sf/vscode-spans/ | head -1`

## Record Format

Each line independent JSON. Discriminate on `kind`.

### Spans (`kind: "span"`)

```jsonl
{"kind":"span","traceId":"abc123","spanId":"def456","parentSpanId":"","name":"ConnectionService.getConnection","spanKind":1,"startTimeUnixNano":"1779461510277547833","endTimeUnixNano":"1779461510278117291","attributes":{"orgId":"00D..."},"events":[],"links":[],"status":{"code":1,"message":""},"resource":{"attributes":{"extension.name":"salesforcedx-vscode-core","service.name":"salesforcedx-vscode-core"}},"instrumentationScope":{"name":"salesforcedx-vscode-core","version":"2026-03-02T01:00.304Z"}}
```

| Field | Notes |
|-------|-------|
| `parentSpanId: ""` | Root span |
| `status.code` | 1=OK, 2=ERROR |
| `spanKind` | OTEL SpanKind +1 (1=INTERNAL, 2=SERVER, 3=CLIENT) |
| `resource.attributes["extension.name"]` | Emitting extension |
| Duration (ms) | `(endTimeUnixNano - startTimeUnixNano) / 1_000_000` |

Identity attrs (`userId`, `cliId`, `webUserId`, `orgId`, `common.*`) stamped **only on root spans** — child spans have them `null`; not a gap. Mirrors the App Insights `properties` exactly. `userId` absent for expired/unauthenticated orgs. Note: an internal diagnostic child span (`maybeUpdateDefaultOrgRef`) annotates the literal string `"undefined"` when SOQL userId is unresolved — that string never reaches exported root spans (filtered out).

```sh
f=$(ls -t ~/.sf/vscode-spans/*.jsonl | head -1)
jq -rc 'select(.kind=="span" and .parentSpanId=="") | {name, userId:.attributes.userId, cliId:.attributes.cliId, webUserId:.attributes.webUserId, orgId:.attributes.orgId}' "$f" | sort -u
```

### Logs (`kind: "log"`)

```jsonl
{"kind":"log","timestamp":"1779463981397000000","severityText":"WARN","severityNumber":30000,"body":"UserIdNotFoundError: Could not determine user ID","traceId":"b4d710...","spanId":"706dfc...","attributes":{"fiberId":"#295"}}
```

| Field | Notes |
|-------|-------|
| `traceId` + `spanId` | Span active when log emitted |
| `severityText` | INFO, WARN, ERROR (filtered by `logLevel`) |
| `body` | String or array (multiple args) |
| `timestamp` | Nanos since epoch |

## Enable (Desktop)

```json
{
  "salesforcedx-vscode-salesforcedx.enableFileTraces": true,
  "salesforcedx-vscode-salesforcedx.logLevel": "info"
}
```

## Enable (Web / run:web)

Web POSTs to local span file server (port 3003). Server must run.

1. `npm run spans:server -w salesforcedx-vscode-services`
2. Add to `.esbuild-web-extra-settings.json` at repo root (gitignored):
   ```json
   { "salesforcedx-vscode-salesforcedx.enableFileTraces": true }
   ```
3. `npm run run:web -w packages/<extension>`

## App Insights Telemetry Capture

Inspect App Insights telemetry each platform would send to Azure — captured locally, never sent. Output: `~/.sf/vscode-appinsights/` (separate from spans), via same server (port 3003).

| Platform | Trigger | Exporter | Endpoint | File prefix |
|----------|---------|----------|----------|-------------|
| Desktop (Node) | Dev/Test mode (auto); `SF_OTEL_INGESTION_ENDPOINT` overrides | Azure Monitor | `/v2.1/track` | `appinsights-` |
| Web | `ESBUILD_WEB_LOCAL=1` (auto under `run:web`) | `@vscode/extension-telemetry` | `/v2.1/track` | `appinsights-web-` |

Start server first: `npm run spans:server -w salesforcedx-vscode-services`

### Desktop (Node)

Extension via `--extensionDevelopmentPath` (F5, `vscode-test`, Playwright desktop e2e) = `ExtensionMode.Development`/`Test`, which **auto-diverts** App Insights to `http://localhost:3003/v2.1/track` — no env var or setting. Telemetry force-enabled (provably can't reach Azure).

Custom port: `SF_OTEL_INGESTION_ENDPOINT=http://localhost:NNNN`.

**Divert Mechanism**: Connection string stays pristine. Both `FilteredAzureMonitorTraceExporter` (dependencies path) and `ApplicationInsightsNodeExporter` (customEvents path) swap their private HTTP transport to POST Breeze envelopes over plain HTTP to `{localIngestionEndpoint}/v2.1/track`. Why swap transport? The Azure SDK's `ConnectionStringParser.sanitizeUrl` force-upgrades `http://` → `https://`, blocking plain-HTTP localhost servers.

Server gzip-decompresses, writes raw **Breeze envelopes** (exact wire format Azure receives). Top-level keys: `name, time, instrumentationKey, sampleRate, tags, version, data`. **No `iKey`, no `target`.** Custom dimensions (IDs, `common.*`) live in `data.baseData.properties`, NOT directly under `baseData`:
```jsonl
{"name":"Microsoft.ApplicationInsights.RemoteDependency","time":"2026-06-15T15:44:24.223Z","instrumentationKey":"f5cbbeba-...","sampleRate":100,"version":1,"tags":{"ai.cloud.role":"salesforcedx-vscode-core","ai.operation.id":"f2da4484..."},"data":{"baseType":"RemoteDependencyData","baseData":{"name":"ConnectionService.getConnection","id":"1250a85f...","success":true,"resultCode":"0","duration":"00:00:00.001","properties":{"common.extname":"salesforcedx-vscode-core","cliId":"00d6...","webUserId":"701b...","userId":"005..."},"measurements":{}}}}
```
Filename: `appinsights-{ISO-timestamp}.jsonl`. `data.baseType`: `RemoteDependencyData` (span path), `MetricData`, `ExceptionData`, or `EventData` (customEvents path).

| Field | Notes |
|-------|-------|
| `instrumentationKey` | connection key (NOT `iKey`) |
| `tags["ai.cloud.role"]` | emitting extension |
| `data.baseData.properties` | custom dimensions: `cliId`, `webUserId`, `userId`, `common.*`, `telemetryTag` |

**Identity lands only on root spans** (`spanTransformProcessor` gates on `!span.parentSpanContext`) → most envelopes/spans lack IDs; that's expected, not a gap. `userId` (SOQL-derived) is absent until an org is authenticated and the query resolves; absent for expired orgs. `cliId`/`webUserId` are install-stable, present once `seedTelemetryIdentities` runs at activation — activation spans firing before that seeding are bare.

**customEvents path** (`EventData`, via `ApplicationInsightsNodeExporter`) only emits when an extension's packageJSON sets `enableCustomEventsFromSpans`. None do today — so only the dependencies path (`RemoteDependencyData`) appears.

Useful queries:
```sh
g=$(ls -t ~/.sf/vscode-appinsights/*.jsonl | head -1)
jq -rc '.data.baseType' "$g" | sort | uniq -c                                  # envelope mix
jq -rc 'select(.data.baseType=="RemoteDependencyData") | {name:.data.baseData.name, role:.tags["ai.cloud.role"], userId:.data.baseData.properties.userId, cliId:.data.baseData.properties.cliId, webUserId:.data.baseData.properties.webUserId}' "$g"
```

### Web

`npm run run:web` builds via `vscode:bundle:local`, setting `ESBUILD_WEB_LOCAL=1` — web exporter POSTs to `http://localhost:3003/v2.1/track` (shared Node endpoint). (`SF_OTEL_INGESTION_ENDPOINT` has no effect on web: connection string hard-coded.)

Payload is **not** Breeze — it's the `@vscode/extension-telemetry` shape:
```jsonl
{"name":"ConnectionService.getConnection","eventType":"event","properties":{"orgId":"00D...","common.extname":"salesforcedx-vscode-core"},"measurements":{"duration":42}}
```
Filename: `appinsights-web-{ISO-timestamp}.jsonl`. `eventType`: `event` (success) or `errorEvent` (failed span).

### Workflow

1. `npm run spans:server -w salesforcedx-vscode-services`
2. Desktop: launch extension in dev/test mode (auto). Web: `npm run run:web -w packages/<extension>` (auto).
3. Trigger commands/spans
4. View: `cat ~/.sf/vscode-appinsights/*.jsonl | jq '.' | less`

### Clear

`rm ~/.sf/vscode-appinsights/*`

## Trace Correlation

Logs reference active span via `traceId` + `spanId`. Reconstruct:

1. Find all spans with a `traceId`
2. Build tree via `parentSpanId` → children
3. Find logs with same `traceId` — belong to span matching their `spanId`
