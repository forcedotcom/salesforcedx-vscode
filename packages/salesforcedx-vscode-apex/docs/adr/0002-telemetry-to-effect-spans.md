# Migrate Apex extension telemetry from the core event API to Effect spans

The Apex extension will retire the legacy core `TelemetryService` event API — `sendEventData`, `sendException`, `sendExtensionDeactivationEvent` — and emit telemetry as Effect spans through the services OTEL layer instead. Per the repo root [ADR-0012](../../../../docs/adr/0012-spans-only-observability.md), production telemetry is span attributes only: there is no logs pipeline for new code, so `Effect.logDebug` / `logError` are local-debug aids, not a replacement for the retired events. Per-event data reaches App Insights only via `annotateRootSpan` from [`@salesforce/effect-ext-utils`](../../../effect-ext-utils/src/annotateRootSpan.ts) — only top-level and command spans export (see the services [observability README](../../../salesforcedx-vscode-services/src/observability/README.md)).

## The `apexLSPLog` decision

The one non-obvious choice this ADR settles: `apexLSPLog` fires once per Jorje feature event, and its allowlist (`apexLspTelemetryAllowlist.ts`) exists to bound App Insights volume. Do **not** make each event its own top-level span — that auto-exports and reinstates exactly the volume the allowlist suppresses. Instead annotate the existing long-lived language-client span via `annotateRootSpan`, keeping the allowlist gate at the `client.onTelemetry` boundary: one span, not N.

## The `apexLSPError` decision

Setup failures emit one top-level `apexLSPError` span from `activateLanguageClient` recovery, with `phase` as the discriminator. Do not also fire from `createServer` `tapError` — that path already fails into the same catch.

## Consequences

- Downstream dashboards keyed on the old event names (`apexLSPSettings`, `apexLSPLog`, `apexLSPError`, deactivation) break. Accepted per team.
- Call-site mappings live with the emitters. `apexLSPError`: one `fireErrorSpan` from `activateLanguageClient` recovery, attr `phase`.
