# Source Tracking Service

Retrieve tracked changes to metadata (local, remote, conflicts). Accessor pattern: call methods directly.

## OrgChange

Owned DTO representing a tracked metadata change:

```typescript
type OrgChange = {
  readonly fullName: string;    // Component name
  readonly type: string;         // Metadata type
  readonly state: string;        // "add", "modify", "delete", etc.
  readonly filePath?: string;    // File path relative to project
};
```

## SourceTrackingService

Query local, remote, or conflicting changes without rebuilding component sets.

### getConflictChanges

Conflicts from source tracking:

```typescript
const conflicts = yield * api.services.SourceTrackingService.getConflictChanges();
// conflicts: OrgChange[]
```

Returns all conflicting changes (local ≠ remote). Empty if no conflicts.

### getLocalChanges

Local uncommitted changes:

```typescript
const local = yield * api.services.SourceTrackingService.getLocalChanges();
// local: OrgChange[]
```

Returns changes not yet committed/deployed to org.

### getRemoteChanges

Remote org changes not in local repo:

```typescript
const remote = yield * api.services.SourceTrackingService.getRemoteChanges();
// remote: OrgChange[]

// With ignore rules applied
const remote = yield * api.services.SourceTrackingService.getRemoteChanges({
  applyIgnore: true
});
```

**Options**:
- `applyIgnore?: boolean` — Filter remote changes using `.forceignore` rules (default: false)

## Usage

Detect conflicts before deploy:

```typescript
const conflicts = yield * api.services.SourceTrackingService.getConflictChanges();
if (conflicts.length > 0) {
  const names = conflicts.map(c => c.fullName).join(', ');
  yield * Effect.sync(() =>
    vscode.window.showWarningMessage(`Conflicts: ${names}`)
  );
}
```

Show local pending changes:

```typescript
const pending = yield * api.services.SourceTrackingService.getLocalChanges();
for (const change of pending) {
  console.log(`${change.state} ${change.type} ${change.fullName}`);
}
```

Query remote org changes:

```typescript
const orgChanges = yield * api.services.SourceTrackingService.getRemoteChanges({
  applyIgnore: true
});
```

## Notes

- All methods return `OrgChange[]` (owned, no external dependencies)
- Traceable — spans annotated with method name + result count
- Requires `SourceTrackingService` layer
