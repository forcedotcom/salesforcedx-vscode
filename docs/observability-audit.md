# Observability Audit — salesforcedx-vscode

## Telemetry Stack

| Component | Version | Purpose |
|-----------|---------|---------|
| `effect` | ^3.20.0 | Runtime — provides `Effect.fn`, `Effect.withSpan`, `Effect.log*` |
| `@effect/opentelemetry` | 0.61.0 | Bridges Effect tracing/logging to OTEL SDK |
| `@opentelemetry/sdk-trace-base` | 2.6.1 | Span processors and exporters |
| `@opentelemetry/sdk-trace-node` | 2.2.0 | Node TracerProvider |
| `@opentelemetry/sdk-trace-web` | 2.7.0 | Web TracerProvider |
| `@opentelemetry/sdk-logs` | 0.203.0 | LogRecordProcessor / LoggerProvider |
| `@opentelemetry/exporter-trace-otlp-http` | 0.214.0 | OTLP trace exporter (HTTP) |
| `@opentelemetry/exporter-logs-otlp-http` | 0.203.0 | OTLP log exporter (HTTP) |
| `@azure/monitor-opentelemetry-exporter` | ^1.0.0-beta.32 | Azure App Insights span export |
| `@salesforce/o11y-reporter` | ^1.8.1 | Internal Salesforce observability |
| Grafana LGTM (dev) | docker | Tempo + Loki + Grafana (local) |

---

## Tracing

### Status: FULLY CONFIGURED — Multi-backend

### Call Sites
- **382** `Effect.fn(...)` sites (automatic child spans)
- **83** `Effect.withSpan(...)` sites (manual spans)
- **All 15+ consumer extensions** get tracing via `buildAllServicesLayer()` → `SdkLayerFor(context)`

### Span Exporters (Node — `spansNode.ts`)

| Exporter | Gated By | Destination | Filtering |
|----------|----------|-------------|-----------|
| ConsoleSpanExporter | `enableConsoleTraces` | stdout | None |
| FilteredAzureMonitorTraceExporter | `telemetry.enabled` | Azure App Insights | Top-level + command spans only |
| O11ySpanExporter | `o11yEndpoint` + telemetry | Salesforce O11y | Top-level spans only |
| OTLPTraceExporter | `enableLocalTraces` | `localhost:4318` | None |
| OtlpFileSpanExporterNode | `enableFileTraces` | `~/.sf/vscode-spans/*.jsonl` | None |

All wrapped in `SpanTransformProcessor` which enriches top-level spans with org, user, VS Code, and system metadata.

### Span Exporters (Web — `spansWeb.ts`)

Same set minus Azure (uses custom `ApplicationInsightsWebExporter`), plus `OtlpFileSpanExporterWeb` (POSTs to localhost:3003).

---

## Logging

### Status: PARTIALLY CONFIGURED — Local/dev only, no production log export

### Current Pipeline (`Logger.ts` path via `NodeSdk.layer`)

```
Effect.logInfo("message")
  → @effect/opentelemetry Logger.make()
  → otelLogger.emit() with traceId/spanId in ATTRIBUTES (not spanContext)
  → [TraceContextLogProcessor] copies attributes → spanContext
  → SimpleLogRecordProcessor
  → OTLPLogExporter (localhost:4318) OR OtlpFileLogExporterNode (~/.sf/vscode-spans/)
```

### Log Exporters (Node only)

| Exporter | Gated By | Destination |
|----------|----------|-------------|
| OTLPLogExporter | `enableLocalTraces` | `localhost:4318/v1/logs` |
| OtlpFileLogExporterNode | `enableFileTraces` | `~/.sf/vscode-spans/*.jsonl` (same file as spans) |

### Log Level Control

- VS Code setting: `salesforcedx-vscode-salesforcedx.logLevel` (default: `error`)
- Env var fallback: `SF_LOG_LEVEL` (fatal→error mapping)
- Applied via `Logger.minimumLogLevel(getLogLevel())`

### Web: NO log export configured

`spansWeb.ts` has no `logRecordProcessor` — logs on web go nowhere.

---

## Trace-to-Log Correlation

### Status: WORKS LOCALLY — requires `TraceContextLogProcessor` shim

**The problem:** `@effect/opentelemetry`'s `Logger.ts` (lines 53-55) places `traceId`/`spanId` in **log attributes**, not the OTEL `spanContext` field. The OTEL SDK's `OTLPLogExporter` reads `spanContext` for wire format, so without intervention the trace/span IDs are empty on the wire.

**Our fix:** `TraceContextLogProcessor` intercepts `onEmit`, copies `attributes.traceId`/`attributes.spanId` → `logRecord.spanContext`, then delegates.

**Alternative (no shim needed):** `@effect/opentelemetry` also exports `OtlpLogger` which serializes OTLP directly and sets `traceId`/`spanId` at the protocol level (lines 147-149 in `OtlpLogger.ts`). This bypasses `@opentelemetry/sdk-logs` entirely and handles correlation natively. Available in our installed version (0.61.0).

---

## Metrics

### Status: NOT CONFIGURED

- `@opentelemetry/sdk-metrics` is a dependency but never instantiated
- No `metricReader` configured in `NodeSdk.layer()`
- No `MeterProvider` usage in source

---

## Observability Gaps

### Severity: HIGH

| # | Gap | Impact |
|---|-----|--------|
| 1 | **No production log export** | Azure App Insights and O11y receive spans but NOT logs. Trace-to-logs correlation impossible in production. |
| 2 | **Web has no log export** | `spansWeb.ts` omits `logRecordProcessor` entirely. Web logs go nowhere. |

### Severity: MEDIUM

| # | Gap | Impact |
|---|-----|--------|
| 3 | **TraceContextLogProcessor shim** | Works but is a workaround. `OtlpLogger` handles this natively without `@opentelemetry/sdk-logs` dependency. |
| 4 | **No metrics** | Zero latency/throughput observability beyond span durations. |
| 5 | **Log level default is `error`** | Most Effect.log/logInfo/logWarning calls never emit. Useful for prod noise reduction but means file/OTLP export is sparse unless user changes setting. |

### Severity: LOW

| # | Gap | Impact |
|---|-----|--------|
| 6 | **No log filtering by span validity** | Spans filtered (top-level/command only for prod), but logs are unfiltered — potential noise. |
| 7 | **Duplicate trace context** | traceId/spanId appear in both `attributes` AND `spanContext` after shim — slightly wasteful on wire. |

---

## Two Paths for OTEL Log Export

### Path A: Current (`Logger.ts` + `@opentelemetry/sdk-logs`) — IMPLEMENTED

```
NodeSdk.layer({ logRecordProcessor: [...] })
  → @effect/opentelemetry Logger.ts (places trace IDs in attributes)
  → TraceContextLogProcessor (shim: attributes → spanContext)
  → SimpleLogRecordProcessor
  → OTLPLogExporter / OtlpFileLogExporterNode
```

**Pros:** Uses standard OTEL SDK, familiar processor/exporter pattern
**Cons:** Requires shim, extra dependency (`@opentelemetry/exporter-logs-otlp-http`), `@opentelemetry/sdk-logs` version alignment issues

### Path B: `OtlpLogger` (Effect-native OTLP) — AVAILABLE, NOT USED

```
OtlpLogger.layer({ url: "http://localhost:4318/v1/logs", resource: {...} })
  → Effect Logger (serializes OTLP proto directly)
  → HttpClient POST to /v1/logs
  → traceId/spanId set natively on log record (no shim)
```

**Pros:** No shim needed, no `@opentelemetry/sdk-logs` dependency, handles correlation natively, uses Effect's HttpClient (built-in batching, backpressure)
**Cons:** Requires `@effect/platform` HttpClient in scope, no file export built-in, newer/less battle-tested

---

## Recommendations

1. **Validate whether the shim is actually needed for Grafana** — Your tech lead may have been using a version/config where correlation works without it. Test by removing `TraceContextLogProcessor`, enabling `enableLocalTraces`, and checking if Grafana's "show related log records" still works. The OTEL SDK's `LogRecord` class may set `spanContext` from the active `context` parameter in newer versions.

2. **Consider `OtlpLogger` for OTLP export** — It's simpler, no shim, handles correlation natively. Could replace the `OTLPLogExporter` + `TraceContextLogProcessor` + `SimpleLogRecordProcessor` chain with a single `OtlpLogger.layer(...)` call.

3. **Keep file export via current approach** — `OtlpLogger` doesn't have file export built in, so `OtlpFileLogExporterNode` remains useful for offline capture.

4. **Add web log export** — Mirror the Node `logRecordProcessor` setup in `spansWeb.ts`.

5. **Lower default log level for dev** — Consider `info` when `enableFileTraces` or `enableLocalTraces` is active, so developers see useful logs without manual setting changes.

---

## Key Files

| File | Role |
|------|------|
| `packages/salesforcedx-vscode-services/src/observability/spansNode.ts` | NodeSdk layer: span + log processors |
| `packages/salesforcedx-vscode-services/src/observability/spansWeb.ts` | WebSdk layer: span processors only |
| `packages/salesforcedx-vscode-services/src/observability/localTracing.ts` | Settings readers + log level |
| `packages/salesforcedx-vscode-services/src/observability/traceContextLogProcessor.ts` | Shim: attributes → spanContext |
| `packages/salesforcedx-vscode-services/src/observability/otlpFileLogExporterNode.ts` | File-based log export |
| `packages/salesforcedx-vscode-services/src/observability/otlpFileSpanExporterNode.ts` | File-based span export |
| `packages/salesforcedx-vscode-services/src/observability/spanTransformProcessor.ts` | Span metadata enrichment |
| `packages/salesforcedx-vscode-services/src/observability/spanUtils.ts` | Span serialization |
| `node_modules/@effect/opentelemetry/src/Logger.ts` | Effect → OTEL bridge (attributes path) |
| `node_modules/@effect/opentelemetry/src/OtlpLogger.ts` | Effect-native OTLP logger (native correlation) |
| `.vscode/launch.json` | Grafana launch configs with OTEL_EXPORTER_OTLP_ENDPOINT |
| `.vscode/tasks.json` | Grafana LGTM docker start task |
