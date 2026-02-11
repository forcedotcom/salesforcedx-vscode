# Common Query Patterns

## Command Usage Frequency

- **Question**: "How often is command X used?"
- **Query**: `customEvents | where name endswith "/commandExecution" and customDimensions.commandName == "X" | summarize count()`

## Most Used Commands

- **Question**: "What are the most used commands?"
- **Query**: `customEvents | where name endswith "/commandExecution" | summarize count() by tostring(customDimensions.commandName) | order by count_ desc | take 10`

## Extension Activity

- **Question**: "Which extensions are most active?"
- **Query**: `customEvents | where name endswith "/commandExecution" | summarize count() by tostring(customDimensions.extensionName) | order by count_ desc`

## Performance Metrics

- **Question**: "What's the average execution time for command X?"
- **Query**: `customEvents | where name endswith "/commandExecution" and customDimensions.commandName == "X" | summarize avg(todouble(customMeasurements.executionTime))`

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
  - If checking a command ID, remind user that telemetry uses executor names, not command IDs
  - Suggest checking the source code to find the executor name
  - Note that some commands don't send telemetry (simple functions)
  - Some commands send telemetry for sub-commands, not the main command