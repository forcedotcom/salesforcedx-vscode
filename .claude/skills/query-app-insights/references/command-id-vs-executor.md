# Command ID vs Executor Name

**Critical**: Commands in `package.json` use command IDs (e.g., `sf.data.query.selection`), but telemetry uses **executor/log names** (e.g., `data_soql_query_library`). These are often different!

## Finding Executor Names

1. **Find command registration** in `packages/*/src/index.ts`:
   ```typescript
   vscode.commands.registerCommand('sf.data.query.selection', dataQuery);
   ```

2. **Find executor implementation** - Look for:
   - `LibraryCommandletExecutor` constructor: `super(name, 'executor_name', channel)`
   - `SfCommandletExecutor` with `withLogName('executor_name')`
   - Executor constants: `const GENERATE_MANIFEST_EXECUTOR = 'project_generate_manifest'`

3. **Common patterns**:
   - Remove `sf.` prefix
   - Convert dots to underscores: `sf.apex.generate.class` → `apex_generate_class`
   - Some add `_library` suffix: `data_soql_query_library`
   - Some use completely different names: `sf.delete.source` → `project_delete_source`

## Commands Without Telemetry

Simple functions that don't use executors **never send telemetry**:
- `sf.open.documentation` - opens URLs
- `sf.task.stop` - terminates tasks
- `sf.conflict.open` - opens resources

Cannot be tracked via telemetry - would need telemetry added manually.

## Commands With Sub-Commands

Some commands don't send telemetry for the main command ID, but send telemetry for sub-commands:
- `sf.debug.isv.bootstrap` sends telemetry for: `isv_debug_bootstrap_create_project`, `isv_debug_bootstrap_configure_project`, etc.
- Check for sub-command patterns when a command appears unused

## Shared Executors

Multiple command IDs can share the same executor:
- `sf.deploy.source.path`, `sf.deploy.current.source.file`, `sf.deploy.multiple.source.paths` → all use `deploy_with_sourcepath`
- `sf.retrieve.source.path`, `sf.retrieve.current.source.file` → both use `retrieve_with_sourcepath`
- `sf.data.query.input`, `sf.data.query.selection` → both use `data_soql_query_library`

When checking usage, search for the executor name, not the command ID.