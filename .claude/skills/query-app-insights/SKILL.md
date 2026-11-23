---
name: query-app-insights
description: Query Azure Application Insights telemetry data for command usage, extension activity, and performance metrics
review: never
disable-model-invocation: true
---

# Query App Insights

Query Azure Application Insights telemetry to answer questions about command usage, extension activity, performance.

## Prerequisites

- `APP_INSIGHTS_API_KEY` env var
- `APP_INSIGHTS_CLIENT_ID` env var

## Workflow

1. **Validate credentials** - check env vars exist
2. **Test API** - `node scripts/queryAppInsights.mts "customEvents | take 1"`
3. **Interpret question** - identify commands, extensions, time ranges, metrics
4. **Find executor name** - if checking a command, find its executor name (see references)
5. **Build KQL query** - use executor names, not command IDs
6. **Execute** - `node scripts/queryAppInsights.mts "<kql-query>"`
7. **Answer** - interpret results, format clearly

## Key Points

- Legacy `/commandExecution` telemetry uses executor names (`commandName`), not command IDs. OTEL command spans expose `command`.
- Event pattern: Legacy names end with `/commandExecution`; OTEL spans use `dependencies` by default on Node and `customEvents` on Web
- Tables: `customEvents` (Legacy events, Web OTEL spans, and configured Node OTEL spans), `dependencies` (default Node OTEL spans), `requests` (Root Spans)
- OTEL fields: `name`, `operation_Id`, `operation_ParentId`; extension name is `cloud_RoleName` in `dependencies`, `customDimensions.common.extname` in Web `customEvents`
- Dependencies root filter: `where operation_ParentId == operation_Id`
- Measurements: `customMeasurements.executionTime` (ms for Legacy) or `duration` (ms for OTEL)
- For Web Console's production store, platform filter, and user-count field, follow [Web Console query patterns](references/query-patterns.md#web-console).

## References

- `references/command-id-vs-executor.md` - Finding executor names, shared executors, commands without telemetry
- `references/query-patterns.md` - Common KQL patterns
- `references/script.md` - Script implementation details
