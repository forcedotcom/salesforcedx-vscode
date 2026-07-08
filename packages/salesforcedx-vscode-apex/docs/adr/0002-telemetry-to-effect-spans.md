# Migrate Apex extension telemetry from the core event API to Effect spans

The Apex extension will retire the legacy core `TelemetryService` event API — `sendEventData`, `sendException`, `sendExtensionDeactivationEvent` — and emit telemetry as **Effect spans** through the services OTEL layer instead. This ADR records the decision and the per-event migration shape; the individual call-site migrations happen under downstream WIs that this one unblocks.

- **Production telemetry is span attributes only.** Per the repo root [ADR-0012](../../../../docs/adr/0012-spans-only-observability.md), all new telemetry flows through OpenTelemetry spans — there are no separate metrics or logs pipelines for new code. Nothing in this migration may model a telemetry destination as a "log". `Effect.logDebug` / `Effect.logError` are local-console / OTLP debug aids only (visible when the Effect log level is Debug); they are **not** a channel to App Insights or O11y and must never be used as a stand-in for the retired event API.

- **Export model.** Only top-level spans and command spans ship to App Insights and O11y; all spans reach the local console / OTLP debug exporters. See the services [observability README](../../../salesforcedx-vscode-services/src/observability/README.md) (routing key points at line 21; the two annotation helpers and the export filter around lines 195-200). Per-event data reaches App Insights only via `annotateRootSpan` from [`@salesforce/effect-ext-utils`](../../../effect-ext-utils/src/annotateRootSpan.ts), which walks to the trace root. `Effect.annotateCurrentSpan` writes the current span only and is local-debug unless that span is itself top-level or a command span.

## Event → span map

All destinations below are spans / span attributes. No entry is a "log".

- **`apexLSPSettings`** (`languageServer.ts:105`, `maxHeapSize` measure) → an attribute on the server-startup span. Use `annotateRootSpan` when emitted below a top-level span so it reaches App Insights.

- **`apexLSPError`** (`languageServer.ts:134`, `sendException(LSP_ERR, …)`; `LSP_ERR = 'apexLSPError'` in `constants.ts:13`) → the enclosing Effect **fails**, so the enclosing span records error status and attributes and becomes an **error span**. It is not an error log.

- **deactivation** (`index.ts:121`, `sendExtensionDeactivationEvent()`) → an attribute on, or a dedicated, deactivate span.

- **`apexLSPLog`** (`languageServer.ts:156`, per-Jorje-feature, allowlist-gated) → see the explicit mechanism decision below.

## `apexLSPLog` export mechanism (the decision this ADR settles)

`client.onTelemetry` fires once per Jorje feature event. `apexLspTelemetryAllowlist.ts` enumerates the Jorje feature names (`JORJE_LSP_TELEMETRY_FEATURES_FROM_SOURCE`, lines 16-67), and `BLOCKED_APEX_LSP_TELEMETRY_FEATURES` (lines 74-108) strips the per-request / high-volume paths — hover, completion strategies, document lifecycle, etc. — so that only lower-volume features flow to App Insights via `isApexLspTelemetryAllowed` (line 119). This volume bound is load-bearing and the migration must preserve it.

- **Do NOT make each `apexLSPLog` event its own top-level span.** Top-level spans ship to App Insights automatically; the many allowlisted features firing repeatedly would reintroduce exactly the volume the blocked-features list exists to suppress.

- **Decision:** attach `apexLSPLog` data as **attributes on the existing long-lived language-client / activation span via `annotateRootSpan`**. Keep the `isApexLspTelemetryAllowed` allowlist gate at the `client.onTelemetry` boundary, before annotating. This is one long-lived span rather than N spans, so the volume bound is preserved while the data still reaches App Insights.

- **Downstream constraint (not solved here):** repeated features annotating the same root span overwrite same-keyed attributes. Migration WIs must namespace keys (for example by feature) or aggregate before annotating.

## Consequences

- Downstream dashboards and queries keyed on the old event names — `apexLSPSettings`, `apexLSPLog`, `apexLSPError`, and the deactivation event — break. Accepted per team.

- **Scope:** this ADR blocks the Apex telemetry migration WIs. The remaining event-API call sites — `apexTestDiscoveryStart` / `apexTestDiscoveryEnd` (`languageUtils/index.ts`), `apexLSPRestart` and `apexLSPStartup` (`languageUtils/languageClientManager.ts`) — migrate under those WIs following the same span model.
