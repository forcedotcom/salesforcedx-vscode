# FsService

File ops (desktop + web). Accessor pattern: call methods directly.

## Methods

### readFile

Read file as string:

```typescript
const content = yield * api.services.FsService.readFile(filePath);
```

### writeFile

Write file, creates dirs if needed:

```typescript
yield * api.services.FsService.writeFile(filePath, content);
```

### fileOrFolderExists

Check if exists:

```typescript
const exists = yield * api.services.FsService.fileOrFolderExists(filePath);
```

### isDirectory

Check if directory:

```typescript
const isDir = yield * api.services.FsService.isDirectory(path);
```

### isFile

Check if file:

```typescript
const isFile = yield * api.services.FsService.isFile(path);
```

### createDirectory

Create directory:

```typescript
yield * api.services.FsService.createDirectory(dirPath);
```

### deleteFile

Delete file:

```typescript
yield * api.services.FsService.deleteFile(filePath, options);
```

### readDirectory

Read dir contents:

```typescript
const uris = yield * api.services.FsService.readDirectory(dirPath);
// Returns: URI[]
```

### stat

Get file stats:

```typescript
const stats = yield * api.services.FsService.stat(filePath);
```

### safeDelete

Delete ignoring errors:

```typescript
yield * api.services.FsService.safeDelete(filePath, options);
```

### rename

Rename file/folder:

```typescript
yield * api.services.FsService.rename(oldPath, newPath);
```

### readJSON

Read + parse JSON. Two options:

**Without schema** — raw parse, result is `unknown`:

```typescript
const text = yield * api.services.FsService.readFile(filePath);
const data = JSON.parse(text) as MyType;
```

**With Effect Schema** — validated and typed:

```typescript
import * as Schema from 'effect/Schema';

const MyConfigSchema = Schema.Struct({
  orgs: Schema.Record({ key: Schema.String, value: Schema.String })
});

const data = yield * api.services.FsService.readJSON(filePath, MyConfigSchema);
// data is typed as { orgs: Record<string, string> }
```

Prefer the schema approach when customers might have corrupted JSON—validation fails with a clear error instead of silently returning bad data.

### toUri

Convert path to URI:

```typescript
const uri = yield * api.services.FsService.toUri(filePath);
```

### uriToPath

Convert URI to path:

```typescript
const path = yield * api.services.FsService.uriToPath(uri);
```

## Errors

- `FsServiceError` - File operation failed

## Examples

From `salesforcedx-vscode-metadata`:

```typescript
const exists = yield * api.services.FsService.fileOrFolderExists(manifestFileUri);
if (!exists) {
  yield * api.services.FsService.writeFile(manifestFileUri, packageXML);
}

const childUris = yield * api.services.FsService.readDirectory(uri);
yield * api.services.FsService.safeDelete(cacheDirUri, { recursive: true });
```

## Notes

- Works with `file://` and virtual FS (e.g., `memfs://`)
- Accepts string paths or URI objects
- Windows paths auto-normalized
- Web: paths without scheme default to `memfs://`
- `writeFile` auto-creates parent dirs
- `safeDelete` never fails (returns `undefined` on error)
- `readJSON` validates against schema
