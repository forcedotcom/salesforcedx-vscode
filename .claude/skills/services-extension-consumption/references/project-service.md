# ProjectService

Salesforce project resolution. Accessor pattern: call methods directly.

## Methods

### isSalesforceProject

Check if workspace is Salesforce project (sfdx-project.json exists):

```typescript
const isProject = yield* api.services.ProjectService.isSalesforceProject();
```

Side effect: sets `sf:project_opened` context.

### getSfProject

Get SfProject (fails if not Salesforce project):

```typescript
const project = yield* api.services.ProjectService.getSfProject();
```

Returns `SfProject` from `@salesforce/core`. Side effect: sets `sf:project_opened` context.

## Errors

- `FailedToResolveSfProjectError` - Can't resolve project
- `NoWorkspaceOpenError` - No workspace (from WorkspaceService)

## Examples

From `salesforcedx-vscode-metadata`:

```typescript
const packageDirs = (yield* api.services.ProjectService.getSfProject()).getPackageDirectories();
```

From `salesforcedx-vscode-org-browser`:

```typescript
const dirs = (yield* api.services.ProjectService.getSfProject()).getPackageDirectories();
```

## Notes

- Cached globally (10 min TTL)
- Cache key: workspace `fsPath`
- Requires `WorkspaceService`
- Use `getSfProject()` for project methods (getPackageDirectories, etc.)
