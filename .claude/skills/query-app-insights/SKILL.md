---
name: query-app-insights
description: Query Azure Application Insights telemetry data for command usage, extension activity, and performance metrics
disable-model-invocation: true
---

# Query App Insights

Query Azure Application Insights telemetry to answer questions about command usage, extension activity, performance.

## Prerequisites

- `APP_INSIGHTS_API_KEY` env var
- `APP_INSIGHTS_CLIENT_ID` env var

## Workflow

1. **Validate credentials** - check env vars exist
2. **Test API** - `tsx scripts/queryAppInsights.ts "customEvents | take 1"`
3. **Interpret question** - identify commands, extensions, time ranges, metrics
4. **Find executor name** - if checking a command, find its executor name (see references)
5. **Build KQL query** - use executor names, not command IDs
6. **Execute** - `tsx scripts/queryAppInsights.ts "<kql-query>"`
7. **Answer** - interpret results, format clearly

## Key Points

- Telemetry uses **executor names**, not command IDs
- Event pattern: ends with `/commandExecution`
- Table: `customEvents`
- Properties: `customDimensions.commandName` (executor name), `customDimensions.extensionName`
- Measurements: `customMeasurements.executionTime` (ms)

## References

- `references/command-id-vs-executor.md` - Finding executor names, shared executors, commands without telemetry
- `references/query-patterns.md` - Common KQL patterns
- `references/script.md` - Script implementation details