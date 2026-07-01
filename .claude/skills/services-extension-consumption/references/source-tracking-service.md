# Source Tracking Service

Query tracked metadata changes (local, remote, conflicts). Direct method calls.

## OrgChange

Owned DTO for tracked metadata change:

```typescript
type OrgChange = {
  readonly fullName: string;    // component name
  readonly type: string;         // metadata type
  readonly state: string;        // "add", "modify", "delete"
  readonly filePath?: string;    // file path (relative to project)
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

Uncommitted local changes:

```typescript
const local = yield * api.services.SourceTrackingService.getLocalChanges();
// local: OrgChange[]

// Apply .forceignore filters
const local = yield * api.services.SourceTrackingService.getLocalChanges({
  applyIgnore: true
});
```

**Options**:
- `applyIgnore?: boolean` — filter with `.forceignore` rules (default: false)

Returns changes pending commit/deploy.

### getRemoteChanges

Remote org changes absent in local repo:

```typescript
const remote = yield * api.services.SourceTrackingService.getRemoteChanges();
// remote: OrgChange[]

// Apply .forceignore filters
const remote = yield * api.services.SourceTrackingService.getRemoteChanges({
  applyIgnore: true
});
```

**Options**:
- `applyIgnore?: boolean` — filter with `.forceignore` rules (default: false)

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

Show pending local changes:

```typescript
const pending = yield * api.services.SourceTrackingService.getLocalChanges();
for (const change of pending) {
  console.log(`${change.state} ${change.type} ${change.fullName}`);
}
```

Query remote changes:

```typescript
const orgChanges = yield * api.services.SourceTrackingService.getRemoteChanges({
  applyIgnore: true
});
```

## Notes

- Returns `OrgChange[]` (owned, no external deps)
- Filters changes lacking `name` or `type` (optional in source-tracking's `ChangeResult`)
- `applyIgnore` — filter marked changes in `.forceignore`
- Traceable — spans annotated w/ method name + result count
- Requires `SourceTrackingService` layer
