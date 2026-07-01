# Metadata Describe Service

Inspect Salesforce metadata types and list metadata members. Accessor pattern: call methods directly.

## Methods

### describeMetadata (use this)

Query metadata types via owned `MetadataTypeInfo` DTO (data-only, no 3pp dependencies):

```typescript
const metadataInfo = yield * api.services.MetadataDescribeService.describeMetadata();
// MetadataTypeInfo[]
```

**MetadataTypeInfo** (owned DTO, mirrors jsforce DescribeMetadataObject):

```typescript
type MetadataTypeInfo = {
  readonly xmlName: string;           // e.g., "ApexClass", "CustomObject"
  readonly directoryName?: string;    // e.g., "classes", "objects"
  readonly inFolder: boolean;         // Folder-type metadata
  readonly metaFile: boolean;         // Requires -meta.xml file
  readonly suffix?: string;           // File extension (e.g., ".cls")
  readonly childXmlNames?: string[];  // Nested type names
};
```

Example:

```typescript
const info = yield * api.services.MetadataDescribeService.describeMetadata();

const apexClass = info.find(t => t.xmlName === 'ApexClass');
// { xmlName: 'ApexClass', directoryName: 'classes', inFolder: false, metaFile: true, suffix: '.cls' }

const customObject = info.find(t => t.xmlName === 'CustomObject');
// { xmlName: 'CustomObject', directoryName: 'objects', inFolder: false, metaFile: true, suffix: '.object' }
```

> The raw jsforce-returning `describe()` was removed from the public services API (W-22419571). Use `describeMetadata()` (owned `MetadataTypeInfo[]`).

### listMetadata

Query metadata members of a type:

```typescript
const members = yield * api.services.MetadataDescribeService.listMetadata('ApexClass');

// Optional folder parameter for folder-type metadata
const dashboards = yield * api.services.MetadataDescribeService.listMetadata('Dashboard', 'MyFolder');
```

Returns `FilePropertiesPlain[]` (schema-validated representation of jsforce FileProperties). Each member includes:

```typescript
type FilePropertiesPlain = {
  type: string;
  fullName: string;
  id: string;
  lastModifiedByName: string;
  lastModifiedDate: string;
  createdByName: string;
  createdDate: string;
  manageableState?: string;
  namespacePrefix?: string;
};
```

## Error Handling

Common errors:

- `MetadataDescribeError` — Connection or API issue
- Standard connection errors from ConnectionService

```typescript
import * as Effect from 'effect/Effect';

yield *
  api.services.MetadataDescribeService.describeMetadata().pipe(
    Effect.catchTag('MetadataDescribeError', (err) =>
      Effect.sync(() => vscode.window.showErrorMessage(`Metadata query failed: ${err.message}`))
    )
  );
```

## Use Cases

**Metadata browser**: Display `MetadataTypeInfo[]` to user, filter by `xmlName`, show `directoryName`:

```typescript
const info = yield * api.services.MetadataDescribeService.describeMetadata();

const typesByFolder = new Map<string | undefined, MetadataTypeInfo[]>();
for (const t of info) {
  const dir = t.directoryName ?? 'root';
  typesByFolder.set(dir, [...(typesByFolder.get(dir) ?? []), t]);
}
```

**Member listing**: Enumerate files in an org by type:

```typescript
const members = yield * api.services.MetadataDescribeService.listMetadata('ApexClass');
members.forEach(m => console.log(`${m.fullName} (${m.type})`));
```

**Build project manifest**: Iterate `MetadataTypeInfo` to construct package.xml:

```typescript
const info = yield * api.services.MetadataDescribeService.describeMetadata();

const types = info
  .filter(t => t.inFolder === false)  // Skip folder types for now
  .map(t => ({ type: t.xmlName, members: ['*'] }));

// Build package.xml...
```

## Notes

- `describe()` returns jsforce DescribeMetadataObject directly (3pp, mutable)
- `describeMetadata()` returns owned `MetadataTypeInfo` (immutable data-only DTO)
- Mapper (`metadataTypeInfoMapper.ts`) isolates jsforce dependency; can be replaced if needed
- Requires `MetadataDescribeService`, `ConnectionService`
