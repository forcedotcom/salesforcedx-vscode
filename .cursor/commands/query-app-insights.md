# Query App Insights Telemetry

Query Azure Application Insights telemetry data to answer questions about command usage, extension activity, and performance metrics.

## Overview

This command enables you to ask natural language questions about telemetry data collected from Salesforce VSCode extensions. The agent will translate your questions into Kusto Query Language (KQL) queries, execute them against the App Insights API, and provide answers based on the results.

## Prerequisites

Before using this command, ensure you have:

- `APP_INSIGHTS_API_KEY` environment variable set (API key for App Insights)
- `APP_INSIGHTS_CLIENT_ID` environment variable set (Application ID)

## Important: Command ID vs Executor Name

**Critical**: Commands in `package.json` use command IDs (e.g., `sf.data.query.selection`), but telemetry uses **executor/log names** (e.g., `data_soql_query_library`). These are often different!

### Finding Executor Names

To find the executor name for a command:

1. **Find the command registration** in `packages/*/src/index.ts`:

   ```typescript
   vscode.commands.registerCommand('sf.data.query.selection', dataQuery);
   ```

2. **Find the executor implementation** - Look for:
   - `LibraryCommandletExecutor` constructor: `super(name, 'executor_name', channel)`
   - `SfCommandletExecutor` with `withLogName('executor_name')`
   - Executor constants: `const GENERATE_MANIFEST_EXECUTOR = 'project_generate_manifest'`

3. **Common patterns**:
   - Remove `sf.` prefix
   - Convert dots to underscores: `sf.apex.generate.class` → `apex_generate_class`
   - Some add `_library` suffix: `data_soql_query_library`
   - Some use completely different names: `sf.delete.source` → `project_delete_source`

### Commands That Don't Send Telemetry

Some commands are simple functions that don't use executors and **never send telemetry**:

- `sf.open.documentation` - Simple function that opens URLs
- `sf.task.stop` - Simple function that terminates tasks
- `sf.conflict.open` - Simple function that opens resources

These commands cannot be tracked via telemetry - they would need telemetry added manually.

### Commands With Sub-Commands

Some commands don't send telemetry for the main command ID, but send telemetry for sub-commands:

- `sf.debug.isv.bootstrap` sends telemetry for: `isv_debug_bootstrap_create_project`, `isv_debug_bootstrap_configure_project`, etc.
- Check for sub-command patterns when a command appears unused

### Shared Executors

Multiple command IDs can share the same executor:

- `sf.deploy.source.path`, `sf.deploy.current.source.file`, `sf.deploy.multiple.source.paths` → all use `deploy_with_sourcepath`
- `sf.retrieve.source.path`, `sf.retrieve.current.source.file` → both use `retrieve_with_sourcepath`
- `sf.data.query.input`, `sf.data.query.selection` → both use `data_soql_query_library`

When checking usage, search for the executor name, not the command ID.

## Workflow

When a user asks a question about telemetry data:

1. **Validate credentials**
   - Check that `APP_INSIGHTS_API_KEY` and `APP_INSIGHTS_CLIENT_ID` environment variables exist
   - If missing, provide clear error message with instructions

2. **Test API connectivity**
   - Run `tsx scripts/queryAppInsights.ts "customEvents | take 1"` to verify API access
   - If connection fails, report the error and stop

3. **Interpret the question**
   - Analyze the user's question to understand what they want to know
   - Identify key entities: commands, extensions, time ranges, metrics (count, average, trends)
   - **If checking a specific command**: First find its executor name by examining the source code (see "Command ID vs Executor Name" section)

4. **Build KQL query**
   - Translate the question into appropriate Kusto Query Language
   - **Use executor names, not command IDs** - If user asks about `sf.data.query.selection`, query for `data_soql_query_library`
   - Use the telemetry data structure:
     - Table: `customEvents`
     - Event name pattern: ends with `/commandExecution` (e.g., `salesforcedx-vscode-core/commandExecution`)
     - Properties: `customDimensions.commandName` (this is the executor name, not command ID), `customDimensions.extensionName`, `customDimensions.orgId`, etc.
     - Measurements: `customMeasurements.executionTime` (milliseconds)
     - Timestamp: `timestamp`

5. **Execute query**
   - Run the query using: `tsx scripts/queryAppInsights.ts "<kql-query>"`
   - Parse the JSON response

6. **Provide answer**
   - Interpret the query results
   - Answer the user's question in natural language
   - Include relevant statistics, numbers, and trends
   - Format data clearly (tables, lists, or summaries)

## Common Question Patterns

### Command Usage Frequency

- **Question**: "How often is command X used?" or "How many times was command X executed?"
- **Query**: `customEvents | where name endswith "/commandExecution" and customDimensions.commandName == "X" | summarize count()`

### Most Used Commands

- **Question**: "What are the most used commands?" or "Show me the top commands"
- **Query**: `customEvents | where name endswith "/commandExecution" | summarize count() by tostring(customDimensions.commandName) | order by count_ desc | take 10`

### Extension Activity

- **Question**: "Which extensions are most active?" or "What extensions send the most telemetry?"
- **Query**: `customEvents | where name endswith "/commandExecution" | summarize count() by tostring(customDimensions.extensionName) | order by count_ desc`

### Performance Metrics

- **Question**: "What's the average execution time for command X?" or "How long does command X take?"
- **Query**: `customEvents | where name endswith "/commandExecution" and customDimensions.commandName == "X" | summarize avg(todouble(customMeasurements.executionTime))`

### Time-Based Queries

- **Question**: "How many command executions in the last 7 days?" or "Show usage for the past week"
- **Query**: `customEvents | where name endswith "/commandExecution" and timestamp > ago(7d) | summarize count()`
- **Question**: "Show command usage trends over time"
- **Query**: `customEvents | where name endswith "/commandExecution" | summarize count() by bin(timestamp, 1d), tostring(customDimensions.commandName) | order by timestamp asc`

### Filtering

- **Question**: "Show commands for extension X" or "What commands does extension Y use?"
- **Query**: `customEvents | where name endswith "/commandExecution" and customDimensions.extensionName == "X" | summarize count() by tostring(customDimensions.commandName) | order by count_ desc`

## Query Execution

Execute queries using the script:

```bash
tsx scripts/queryAppInsights.ts "<kql-query>"
```

The script returns JSON with this structure:

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

## Examples

**User**: "What are the most used commands?"
**Agent**:

1. Validates credentials ✓
2. Tests API connection ✓
3. Builds query: `customEvents | where name endswith "/commandExecution" | summarize count() by tostring(customDimensions.commandName) | order by count_ desc | take 10`
4. Executes query
5. Returns: "The most used commands are: [list with counts]"

**User**: "How many times was 'sfdx force:source:push' executed in the last month?"
**Agent**:

1. Validates credentials ✓
2. Tests API connection ✓
3. Builds query: `customEvents | where name endswith "/commandExecution" and customDimensions.commandName == "sfdx force:source:push" and timestamp > ago(30d) | summarize count()`
4. Executes query
5. Returns: "The command 'sfdx force:source:push' was executed X times in the last 30 days."

**User**: "Is sf.data.query.selection being used?"
**Agent**:

1. Validates credentials ✓
2. Tests API connection ✓
3. Finds executor name: Checks source code, finds `dataQuery` function uses `DataQueryExecutor` with logName `data_soql_query_library`
4. Builds query: `customEvents | where name endswith "/commandExecution" and customDimensions.commandName == "data_soql_query_library" and timestamp > ago(30d) | summarize count()`
5. Executes query
6. Returns: "Yes, `sf.data.query.selection` is being used. It's tracked as `data_soql_query_library` and was executed 21,283 times in the last 30 days."

**User**: "Does sf.debug.isv.bootstrap send telemetry?"
**Agent**:

1. Validates credentials ✓
2. Tests API connection ✓
3. Examines source code: Finds `IsvDebugBootstrapExecutor` sends telemetry for sub-commands, not the main command
4. Builds query: `customEvents | where name endswith "/commandExecution" and customDimensions.commandName startswith "isv_debug_bootstrap" and timestamp > ago(30d) | summarize count() by tostring(customDimensions.commandName)`
5. Executes query
6. Returns: "`sf.debug.isv.bootstrap` sends telemetry for its sub-commands, not the main command. Found: `isv_debug_bootstrap_retrieve_packages_source` (49 executions), `isv_debug_bootstrap_create_project` (6 executions), etc."
