# Metadata Deploy & Retrieve Services

Deploy/retrieve Salesforce metadata from source specs, returning owned outcome types. Accessor pattern: call methods directly.

## SourceSpec

Unified input for deploy/retrieve: paths, manifest, or project directories.

```typescript
type SourceSpec =
  | { kind: 'paths'; uris: readonly string[] }           // File/dir URIs
  | { kind: 'manifest'; manifestUri: string }            // package.xml
  | { kind: 'projectDirectories'; members?: readonly OwnedMetadataMember[] }; // All package dirs, optionally filtered by members

type OwnedMetadataMember = { type: string; fullName: string };
```

## MetadataDeployService

### deployFromSource

Deploy from SourceSpec → owned DeployOutcome:

```typescript
const outcome = yield * api.services.MetadataDeployService.deployFromSource(
  { kind: 'paths', uris: ['file:///path/to/ApexClass.cls'] }
);

// Manifest
const outcome = yield * api.services.MetadataDeployService.deployFromSource(
  { kind: 'manifest', manifestUri: 'file:///path/package.xml' }
);

// Project directories
const outcome = yield * api.services.MetadataDeployService.deployFromSource(
  { kind: 'projectDirectories' }
);

// With options
const outcome = yield * api.services.MetadataDeployService.deployFromSource(
  { kind: 'paths', uris: ['file:///path/to/ApexClass.cls'] },
  { ignoreConflicts: true }
);
```

**DeployFromSourceOptions**:
- `ignoreConflicts?: boolean` — Skip conflict checks

**DeployOutcome** (owned DTO):
- `success: boolean`
- `status: string` — SDR RequestStatus (e.g., "Succeeded", "SucceededPartial", "Failed", "Canceled")
- `appliedToOrg: boolean` — True when org applied at least part of the deploy
- `completedDate?: string` — ISO-8601 server completedDate when present
- `fileResponses: FileResponseInfo[]`
- `componentFailures: ComponentFailureInfo[]` — Server-level component failures from response.details.componentFailures
- `errorMessage?: string` — Server-reported top-level error message when deploy failed

**FileResponseInfo**:
- `fullName: string` — Component name
- `type: string` — Metadata type
- `state: string` — SDR file state (e.g., "Created", "Changed", "Unchanged", "Deleted", "Failed")
- `filePath?: string`
- `error?: string` — Error message (if failed)
- `lineNumber?: number` — 1-based line of failure when org reported one
- `columnNumber?: number` — 1-based column of failure when org reported one
- `problemType?: string` — SDR problemType (e.g., "Error", "Warning"); absent for successes

**ComponentFailureInfo**:
- `fullName: string` — Component name
- `type: string` — Metadata type
- `problem: string` — Error message
- `problemType: string` — "Error" or "Warning"

## MetadataRetrieveService

### retrieveToSource

Retrieve from SourceSpec → owned RetrieveOutcome:

```typescript
const outcome = yield * api.services.MetadataRetrieveService.retrieveToSource(
  { kind: 'paths', uris: ['file:///path/to/src'] }
);

// With option
const outcome = yield * api.services.MetadataRetrieveService.retrieveToSource(
  { kind: 'manifest', manifestUri: 'file:///path/package.xml' },
  { ignoreConflicts: false }
);

// Project directories
const outcome = yield * api.services.MetadataRetrieveService.retrieveToSource(
  { kind: 'projectDirectories' }
);
```

**RetrieveOptions**:
- `ignoreConflicts?: boolean` — Skip conflict checks

**RetrieveOutcome** (owned DTO):
- `success: boolean`
- `status: string` — SDR RequestStatus (e.g., "Succeeded", "Failed")
- `fileResponses: FileResponseInfo[]`
- `components: RetrievedComponentInfo[]` — Per-component server metadata from fileProperties

**RetrievedComponentInfo**:
- `type: string` — Metadata type
- `fullName: string` — Component name
- `lastModifiedDate: string` — ISO-8601 timestamp

## ComponentSetService

### buildComponentSet

Dispatch SourceSpec to appropriate getter (internal router):

```typescript
const cs = yield * api.services.ComponentSetService.buildComponentSet(
  { kind: 'paths', uris: ['file:///path/to/ApexClass.cls'] }
);

const cs = yield * api.services.ComponentSetService.buildComponentSet(
  { kind: 'manifest', manifestUri: 'file:///path/package.xml' }
);

const cs = yield * api.services.ComponentSetService.buildComponentSet(
  { kind: 'projectDirectories' }
);
```

Returns `ComponentSet` from `@salesforce/source-deploy-retrieve`. Routes to:
- `getComponentSetFromUris()` for paths
- `getComponentSetFromManifest()` for manifest
- `getComponentSetFromProjectDirectories()` for directories

## Error Handling

Common errors from deploy/retrieve methods:

- `FailedToBuildComponentSetError` — Can't resolve components from SourceSpec
- `EmptyComponentSetError` — SourceSpec resolved to 0 components
- `UserCancellationError` — User cancelled
- Standard deploy/retrieve errors from SDR

```typescript
import * as Effect from 'effect/Effect';

yield *
  api.services.MetadataDeployService.deployFromSource(spec).pipe(
    Effect.catchTag('FailedToBuildComponentSetError', (err) =>
      Effect.sync(() => vscode.window.showErrorMessage(`Build failed: ${err.message}`))
    ),
    Effect.catchTag('UserCancellationError', () => Effect.void)
  );
```

## Example

Deploy from active editor:

```typescript
const deploySpec: SourceSpec = { kind: 'paths', uris: [editorUri.toString()] };

const outcome = yield *
  api.services.MetadataDeployService.deployFromSource(deploySpec).pipe(
    Effect.tap((result) =>
      Effect.sync(() => {
        if (result.success) {
          vscode.window.showInformationMessage('Deploy succeeded');
        } else {
          const failures = result.fileResponses.filter(f => f.error);
          vscode.window.showErrorMessage(`Deploy failed: ${failures.length} errors`);
        }
      })
    )
  );
```

## Introspection

For component metadata without deploy/retrieve, use `ComponentSetService.describeProjectComponents()`:

```typescript
const info = yield * api.services.ComponentSetService.describeProjectComponents(spec);
// info.components[], info.packageXml, info.size, info.sourceApiVersion
```

See [ComponentSetService](component-set-service.md) for details. Returns owned types (no SDR dependency).

## Notes

- `deployFromSource` / `retrieveToSource` wrap `deploy` / `retrieveComponentSet`
- Mapper (`deployMapper.ts`) converts SDR results to owned DTOs
- All methods annotate spans with `specKind`
- Requires `MetadataDeployService`, `MetadataRetrieveService`, `ComponentSetService`, `ConnectionService`
