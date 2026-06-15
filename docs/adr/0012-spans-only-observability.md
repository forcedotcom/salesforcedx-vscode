# Observability is spans-only

All telemetry flows through OpenTelemetry spans — there are no separate metrics or logs pipelines. Spans route by configuration: all spans to local console/OTLP debug exporters; top-level and command spans to App Insights and O11y. See [observability/README.md](../../packages/salesforcedx-vscode-services/src/observability/README.md).
