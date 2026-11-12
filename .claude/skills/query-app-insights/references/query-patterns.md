# Common Query Patterns

## Command Usage Frequency

- **Question**: "How often is command X used?"
- **Query**: `customEvents | where name endswith "/commandExecution" and customDimensions.commandName == "X" | summarize count()`

## Web Console

- `test-otel-effect`: real production App Insights store for Web Console telemetry despite the name; don't classify its events as test traffic. The Web exporter uses its fixed default connection string: [appInsights.ts](../../../../packages/salesforcedx-vscode-services/src/observability/appInsights.ts), [applicationInsightsWebExporter.ts](../../../../packages/salesforcedx-vscode-services/src/observability/applicationInsightsWebExporter.ts).
- Web Console spans are in `customEvents`. Filter `tostring(customDimensions["service.platform"]) == "web"`; [spansWeb.ts](../../../../packages/salesforcedx-vscode-services/src/observability/spansWeb.ts) sets this field. Extension name: `customDimensions.common.extname`, not `cloud_RoleName`.
- Distinct Web Console users: `dcount(tostring(customDimensions["webUserId"]))`, not App Insights `user_Id` or `customDimensions.userId`. `webUserId` is a one-way hash stable across org switches; `userId` is the org's Salesforce user ID. See [ADR-0019](../../../../docs/adr/0019-telemetry-ids.md).
- **Question**: "Which Web Console commands are used most, and by how many users?"
- **Query**:

```kusto
customEvents
| where timestamp > ago(30d)
| where tostring(customDimensions["service.platform"]) == "web"
| where isnotempty(tostring(customDimensions["command"]))
| summarize executions=count(), users=dcount(tostring(customDimensions["webUserId"])) by command=tostring(customDimensions["command"])
| order by executions desc
```

- For total distinct Web Console users, use the same platform filter and `summarize users=dcount(tostring(customDimensions["webUserId"]))`.

## Most Used Commands (Legacy/v2)

- **Question**: "What are the most used commands?"
- **Query**: `customEvents | where name endswith "/commandExecution" | summarize count() by tostring(customDimensions.commandName) | order by count_ desc | take 10`

## Most Used Commands (OTEL/v3)

- **Question**: "What are the most used top-level commands in v3?"
- **Query**: `dependencies | where timestamp > ago(1d) | where operation_ParentId == operation_Id | summarize count() by name, cloud_RoleName | order by count_ desc | take 20`

## Extension Activity (OTEL/v3)

- **Question**: "Which extensions are most active in v3?"
- **Query**: `dependencies | where timestamp > ago(1d) | where operation_ParentId == operation_Id | summarize count() by cloud_RoleName | order by count_ desc`

## Performance Metrics (OTEL/v3)

- **Question**: "What's the average duration for span X in v3?"
- **Query**: `dependencies | where timestamp > ago(1d) | where name == "X" | summarize avg(duration)`

## Filtering Top-Level Spans (OTEL/v3)

- **Question**: "Show me only top-level spans that look like commands."
- **Query**: `dependencies | where timestamp > ago(1h) | where operation_ParentId == operation_Id | where name contains "command" or name contains "." or name contains ":" | summarize count() by name, cloud_RoleName | order by count_ desc`

## Reconstructing a Trace (OTEL/v3)

- **Question**: "Show me all spans for a specific operation/trace."
- **Query**: `dependencies | where operation_Id == "TRACE_ID" | order by timestamp asc | project timestamp, id, operation_ParentId, name, type, duration`

## Time-Based Queries

- **Last 7 days**: `customEvents | where name endswith "/commandExecution" and timestamp > ago(7d) | summarize count()`
- **Trends over time**: `customEvents | where name endswith "/commandExecution" | summarize count() by bin(timestamp, 1d), tostring(customDimensions.commandName) | order by timestamp asc`

## Filtering

- **By extension**: `customEvents | where name endswith "/commandExecution" and customDimensions.extensionName == "X" | summarize count() by tostring(customDimensions.commandName) | order by count_ desc`

## Response Structure

```json
{
  "tables": [{
    "name": "PrimaryResult",
    "columns": [{"name": "column1", "type": "string"}, ...],
    "rows": [[value1, value2, ...], ...]
  }]
}
```

## Error Handling

- **Missing credentials**: Provide clear message about setting environment variables
- **API connection failure**: Report the error message from the API
- **Invalid query**: Show the KQL error message and suggest corrections
- **No results**:
  - For Legacy `/commandExecution`, check the executor name in `customDimensions.commandName`, not the VS Code command ID
  - For Web OTEL spans, check `customDimensions.command` and the `service.platform == "web"` filter
  - Note that some commands don't send telemetry (simple functions)
  - Some commands send telemetry for sub-commands, not the main command
