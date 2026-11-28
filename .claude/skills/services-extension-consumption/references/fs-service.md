# FsService

File ops (desktop + web). V2 uses `Context.Service`; call methods through `.use` or yield the service.

## Methods

### readFile

Read file as string:

```typescript
const content = yield* api.v2.services.FsService.use(service => service.readFile(filePath));
```

### writeFile

Write file, creates dirs if needed:

```typescript
yield* api.v2.services.FsService.use(service => service.writeFile(filePath, content));
```

### fileOrFolderExists

Check if exists:

```typescript
const exists = yield* api.v2.services.FsService.use(service => service.fileOrFolderExists(filePath));
```

### isDirectory

Check if directory:

```typescript
const isDir = yield* api.v2.services.FsService.use(service => service.isDirectory(path));
```

### isFile

Check if file:

```typescript
const isFile = yield* api.v2.services.FsService.use(service => service.isFile(path));
```

### createDirectory

Create directory:

```typescript
yield* api.v2.services.FsService.use(service => service.createDirectory(dirPath));
```

### deleteFile

Delete file:

```typescript
yield* api.v2.services.FsService.use(service => service.deleteFile(filePath, options));
```

### readDirectory

Read dir contents:

```typescript
const uris = yield* api.v2.services.FsService.use(service => service.readDirectory(dirPath));
// Returns: URI[]
```

### readDirectoryWithTypes

Read dir contents preserving `FileType` per entry (avoids extra stat calls for recursive traversal):

```typescript
const entries = yield* api.v2.services.FsService.use(service => service.readDirectoryWithTypes(dirPath));
// Returns: Array<{ uri: URI, type: vscode.FileType }>
const dirs = entries.filter(e => e.type === vscode.FileType.Directory);
```

### stat

Get file stats:

```typescript
const stats = yield* api.v2.services.FsService.use(service => service.stat(filePath));
```

### safeDelete

Delete ignoring errors:

```typescript
yield* api.v2.services.FsService.use(service => service.safeDelete(filePath, options));
```

### rename

Rename file/folder:

```typescript
yield* api.v2.services.FsService.use(service => service.rename(oldPath, newPath));
```

### readJSON

Read + parse JSON. Two options:

**Without schema** — raw parse, result is `unknown`:

```typescript
const text = yield* api.v2.services.FsService.use(service => service.readFile(filePath));
const data = JSON.parse(text) as MyType;
```

**With Effect Schema** — validated and typed:

```typescript
import * as Schema from 'effect/Schema';

const MyConfigSchema = Schema.Struct({
  orgs: Schema.Record(Schema.String, Schema.String)
});

const decodeMyConfig = Schema.decodeUnknownEffect(MyConfigSchema);
const data = yield* api.v2.services.FsService.use(service => service.readJSON(filePath, decodeMyConfig));
// data is typed as { orgs: Record<string, string> }
```

Prefer the schema approach when customers might have corrupted JSON—validation fails with a clear error instead of silently returning bad data.

### showTextDocument

Open file in editor:

```typescript
const editor = yield* api.v2.services.FsService.use(service => service.showTextDocument(filePath, options));
// filePath: string | URI
// options?: vscode.TextDocumentShowOptions
// Returns: vscode.TextEditor
```

### toUri

Convert path to URI:

```typescript
const uri = yield* api.v2.services.FsService.use(service => service.toUri(filePath));
```

### uriToPath

Convert URI to path:

```typescript
const path = yield* api.v2.services.FsService.use(service => service.uriToPath(uri));
```

### HashableUri

`vscode-uri` `URI` lacks value equality → same-file URIs = distinct HashSet/HashMap keys. `FsService.HashableUri` wraps `URI` w/ Effect `Hash`/`Equal` (structural; identity is `comparisonKey` of URI fields, not `.toString()`). Use for dedupe/compare instead of hand-rolled `uri.toString()`. Windows file-drive Equal/Hash casing: `packages/salesforcedx-vscode-services/CONTEXT.md` HashableUri (`comparisonPath`).

Value namespace on the service, not an Effect-returning method. 2 ways to reach:

```typescript
// 1. resolved instance:
const fsService = yield* api.v2.services.FsService;
const key = fsService.HashableUri.fromUri(uri); // sourceDiff.ts, diffHelpers.ts

// 2. accessor pulls the namespace out:
const HashableUri = yield* api.v2.services.FsService.use(service => service.HashableUri); // conflictDetection.ts:29
const filter = HashSet.fromIterable(uris.map(HashableUri.fromUri));
```

Compare via `Equal.equals` (`effect/Equal`):

```typescript
Equal.equals(fsService.HashableUri.fromUri(uri1), fsService.HashableUri.fromUri(uri2)); // true if same comparisonKey
```

Underlying `URI` via `.uri`. Never deep-import from `salesforcedx-vscode-services/src/...` — bare index import pulls observability SDK side effect, breaks Vitest.

## Errors

- `FsServiceError` - File operation failed

## Examples

From `salesforcedx-vscode-metadata`:

```typescript
const exists = yield* api.v2.services.FsService.use(service => service.fileOrFolderExists(manifestFileUri));
if (!exists) {
  yield* api.v2.services.FsService.use(service => service.writeFile(manifestFileUri, packageXML));
}

const childUris = yield* api.v2.services.FsService.use(service => service.readDirectory(uri));
yield* api.v2.services.FsService.use(service => service.safeDelete(cacheDirUri, { recursive: true }));
```

## Notes

- Works with `file://` and virtual FS (e.g., `memfs://`)
- Accepts string paths or URI objects
- Windows paths auto-normalized
- Web: paths without scheme default to `memfs://`
- `writeFile` auto-creates parent dirs
- `safeDelete` never fails (returns `undefined` on error)
- `readJSON` validates against schema
- `HashableUri` gives URIs value-based `Hash`/`Equal` — use for `HashSet`/`HashMap` keys or URI comparison; never deep-import it from `salesforcedx-vscode-services/src/...`
