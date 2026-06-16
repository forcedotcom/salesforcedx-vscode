# Observability is spans-only

All *new* telemetry flows through OpenTelemetry spans — there are no separate metrics or logs pipelines for new code. Spans route by configuration: all spans to local console/OTLP debug exporters; top-level and command spans to App Insights and O11y. See [observability/README.md](../../packages/salesforcedx-vscode-services/src/observability/README.md).

The exception is the legacy event-based `TelemetryService` (`sendCommandEvent`, `sendException`, `sendEventData`), which emits VS Code `TelemetryReporter` events, not spans. It is kept alive only because it is part of the frozen `salesforcedx-vscode-core` API surface (see [ADR-0006](./0006-core-api-frozen-sunset.md)) with external consumers; it is not a pattern for new code.
