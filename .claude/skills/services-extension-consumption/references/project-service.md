# ProjectService

Salesforce project resolution. Accessor pattern: call methods directly.

## Methods

### isSalesforceProject

Check if workspace is Salesforce project (sfdx-project.json exists):

```typescript
const isProject = yield * api.services.ProjectService.isSalesforceProject();
```

Side effect: sets `sf:project_opened` context.

### getSfProject

Get SfProject (fails if not Salesforce project):

```typescript
const project = yield * api.services.ProjectService.getSfProject();
```

Returns `SfProject` from `@salesforce/core`. Side effect: sets `sf:project_opened` context.

### getProjectInfo

Get owned `ProjectInfo` DTO (data-only):

```typescript
const info = yield * api.services.ProjectService.getProjectInfo();
// { path, name, sourceApiVersion?, namespace?, defaultPackage, packageDirectories,
//   soqlMetadataPath, soqlCustomObjectsPath, soqlStandardObjectsPath,
//   fauxStandardObjectsPath, fauxCustomObjectsPath, typingsPath }
```

**ProjectInfo** (services-owned data DTO):
- `path: string` — project root
- `name: string` — workspace folder basename
- `sourceApiVersion?: string` — from sfdx-project.json
- `namespace?: string` — from sfdx-project.json
- `defaultPackage: PackageDirInfo` — default package dir
- `packageDirectories: PackageDirInfo[]` — all package dirs
- `soqlMetadataPath: string` — SOQL metadata dir (fsPath)
- `soqlCustomObjectsPath: string` — custom objects dir (fsPath)
- `soqlStandardObjectsPath: string` — standard objects dir (fsPath)
- `fauxStandardObjectsPath: string` — faux standard objects dir (fsPath)
- `fauxCustomObjectsPath: string` — faux custom objects dir (fsPath)
- `typingsPath: string` — typings dir (fsPath)

**PackageDirInfo** (per-directory metadata):
- `name?: string` — package name
- `path: string` — relative path from project root
- `default: boolean` — is default package
- `fullPath: string` — absolute path

Use `getProjectInfo()` for immutable metadata; use `getSfProject()` for live package operations.

## Errors

- `FailedToResolveSfProjectError` - Can't resolve project
- `NoWorkspaceOpenError` - No workspace (from WorkspaceService)

## Examples

From `salesforcedx-vscode-metadata`:

```typescript
const packageDirs = (yield * api.services.ProjectService.getSfProject()).getPackageDirectories();
```

From `salesforcedx-vscode-org-browser`:

```typescript
const dirs = (yield * api.services.ProjectService.getSfProject()).getPackageDirectories();
```

## Notes

- Cached globally (10 min TTL)
- Cache key: workspace `fsPath`; `vscode-test-web://` workspaces with `.vscode/vscode-extension-test-disk-root.txt` (E2E headless): file body = disk path for `@salesforce/core` `SfProject` cache
- `SfProject.resolve` fails (e.g. virtual mount): `isSalesforceProject` may still true via root `sfdx-project.json` `vscode.workspace.fs` stat; `getSfProject` no that fallback—can fail while flag true
- `isSalesforceProject` cache `tapError` sets `sf:project_opened` false on resolve/cache errors; `FailedToResolveSfProjectError` then `catchTag` fallback may set context again from manifest stat
- Requires `WorkspaceService`
- Use `getSfProject()` for project methods (getPackageDirectories, etc.)
