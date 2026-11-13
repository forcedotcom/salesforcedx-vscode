# EditorService

Active editor changes and URI access. V2 service access uses `Context.Service.use`.

## Layer Setup

The shared V2 service graph includes `EditorService`; don't add a second implementation layer.

No additional layer is needed for `EditorService`; it comes from the shared V2 graph.

## Methods

### getActiveEditorUri

Get URI from active editor, fails with `NoActiveEditorError` if none:

```typescript
const uri = yield* api.v2.services.EditorService.use(service => service.getActiveEditorUri());
// Returns: URI
// Throws: NoActiveEditorError if no active editor
```

### getActiveEditorText

Get text from active editor (selection if `selection=true` and non-empty, else full document), fails with `NoActiveEditorError` if none:

```typescript
const text = yield* api.v2.services.EditorService.use(service => service.getActiveEditorText(true));
// Returns: string (selection or full document)
// Throws: NoActiveEditorError if no active editor
```

### getActiveEditorContext

Get text, URI, and optional selection range from active editor. Use `selection=true` to include selection offset:

```typescript
const ctx = yield* api.v2.services.EditorService.use(service => service.getActiveEditorContext(true));
// Returns: { text: string; documentUri: URI; selectionRange?: { startLine: number; startCharacter: number } }
// Throws: NoActiveEditorError if no active editor
```

### pubsub

PubSub stream of active editor changes (`vscode.TextEditor | undefined`):

```typescript
const editorService = yield* api.v2.services.EditorService;
// editorService.pubsub: PubSub.PubSub<vscode.TextEditor | undefined>
```

## Watching Editor Changes

Watch active editor changes:

```typescript
import * as Duration from 'effect/Duration';
import * as Stream from 'effect/Stream';

const editorService = yield* api.v2.services.EditorService;

// Get initial state and merge with changes
yield *
  Stream.merge(
    Stream.fromEffect(
      editorService.getActiveEditorUri().pipe(Effect.catchTag('NoActiveEditorError', () => Effect.succeed(undefined)))
    ),
    Stream.fromPubSub(editorService.pubsub).pipe(Stream.map(editor => editor?.document.uri))
  ).pipe(
    Stream.debounce(Duration.millis(50)),
    Stream.changes,
    Stream.runForEach(uri => {
      // Handle editor change
    })
  );
```

## Examples

From `salesforcedx-vscode-services` (package directories context):

```typescript
const editorService = yield * EditorService;
const projectService = yield * ProjectService;

yield *
  Stream.merge(
    Stream.fromEffect(
      editorService.getActiveEditorUri().pipe(Effect.catchTag('NoActiveEditorError', () => Effect.succeed(undefined)))
    ),
    Stream.fromPubSub(editorService.pubsub).pipe(Stream.map(editor => editor?.document.uri))
  ).pipe(
    Stream.debounce(Duration.millis(50)),
    Stream.changes,
    Stream.runForEach(uri =>
      uri
        ? projectService.isInPackageDirectories(uri).pipe(
            Effect.flatMap(setInPackageDirectoriesContext),
            Effect.catch(() => setInPackageDirectoriesContext(false))
          )
        : setInPackageDirectoriesContext(false)
    )
  );
```

## Notes

- `pubsub` publishes current editor on subscription and on every change
- Use `Stream.merge` with initial state to handle first load
- Use `Stream.changes` to only react to actual URI changes
- Debounce to avoid rapid-fire updates
- `NoActiveEditorError` - no active text editor is open
