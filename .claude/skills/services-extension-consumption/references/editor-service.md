# EditorService

Active editor changes and URI access. Accessor pattern: call methods directly.

## Layer Setup

Include in your services layer:

```typescript
api.services.EditorService.Default;
```

## Methods

### getActiveEditorUri

Get URI from active editor, fails with `NoActiveEditorError` if none:

```typescript
const uri = yield * api.services.EditorService.getActiveEditorUri();
// Returns: URI
// Throws: NoActiveEditorError if no active editor
```

### pubsub

PubSub stream of active editor changes (`vscode.TextEditor | undefined`):

```typescript
const editorService = yield * api.services.EditorService;
// editorService.pubsub: PubSub.PubSub<vscode.TextEditor | undefined>
```

## Watching Editor Changes

Watch active editor changes:

```typescript
import * as Duration from 'effect/Duration';
import * as Stream from 'effect/Stream';

const editorService = yield * api.services.EditorService;

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
            Effect.catchAll(() => setInPackageDirectoriesContext(false))
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
