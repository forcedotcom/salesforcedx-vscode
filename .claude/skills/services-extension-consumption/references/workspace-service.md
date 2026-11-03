# WorkspaceService

Workspace info access. Accessor pattern: call methods directly.

## Methods

### getWorkspaceInfo

Get workspace info (may be empty):

```typescript
const info = yield* api.v2.services.WorkspaceService.use(service => service.getWorkspaceInfo());
// { uri, path, fsPath, isEmpty, isVirtualFs, cwd }
```

### getWorkspaceInfoOrThrow

Get workspace info, throws if none open:

```typescript
const info = yield* api.v2.services.WorkspaceService.use(service => service.getWorkspaceInfoOrThrow());
// { uri, path, fsPath, isEmpty: false, isVirtualFs, cwd }
// Throws: NoWorkspaceOpenError
```

## Examples

From `salesforcedx-vscode-metadata`:

```typescript
const workspaceInfo = yield* api.v2.services.WorkspaceService.use(service => service.getWorkspaceInfoOrThrow());
const project = yield* api.v2.services.ProjectService.use(service => service.getSfProject());
const packageDirs = project.getPackageDirectories();
```

## Notes

- `isEmpty` — no workspace folders
- `isVirtualFs` - non-file scheme (e.g., memfs://)
- `fsPath` normalized (backslashes → forward slashes for virtual FS)
- Cached globally; web: memo on first `yield*` (not import), so folders exist before snapshot
