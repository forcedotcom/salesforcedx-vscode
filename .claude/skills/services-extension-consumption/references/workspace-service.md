# WorkspaceService

Workspace info access. Accessor pattern: call methods directly.

## Methods

### getWorkspaceInfo

Get workspace info (may be empty):

```typescript
const info = yield* api.services.WorkspaceService.getWorkspaceInfo();
// { uri, path, fsPath, isEmpty, isVirtualFs, cwd }
```

### getWorkspaceInfoOrThrow

Get workspace info, throws if none open:

```typescript
const info = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();
// { uri, path, fsPath, isEmpty: false, isVirtualFs, cwd }
// Throws: NoWorkspaceOpenError
```

## Examples

From `salesforcedx-vscode-metadata`:

```typescript
const workspaceInfo = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();
const packageDirs = (yield* api.services.ProjectService.getSfProject()).getPackageDirectories();
```

## Notes

- `isEmpty` - workspace folders exist
- `isVirtualFs` - non-file scheme (e.g., memfs://)
- `fsPath` normalized (backslashes → forward slashes for virtual FS)
- Cached globally
