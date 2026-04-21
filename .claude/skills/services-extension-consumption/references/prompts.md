# VS Code Prompts

Best practices for `quickPick` and `quickInput` in Effect-TS.

## PromptService

### `considerUndefinedAsCancellation`

Converts `undefined` (Esc) or empty strings to `UserCancellationError`.

```typescript
const choice =
  yield *
  Effect.promise(() => vscode.window.showQuickPick(['a', 'b'])).pipe(
    Effect.flatMap(promptService.considerUndefinedAsCancellation)
  );
```

### `withProgress`

Pipeable operator. Shows a VS Code progress notification (Notification location, non-cancellable) for the lifetime of an Effect; dismisses on completion (success or failure).

Signature: `(title: string) => <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>`

Title must use `nls.localize()` — enforced by the `no-vscode-progress-title-literals` ESLint rule.

```typescript
yield * fetchMetadata().pipe(
  promptService.withProgress(nls.localize('fetching_metadata'))
);
```

### `ensureMetadataOverwriteOrThrow`

Checks file existence; prompts for overwrite. Fails with `UserCancellationError` on cancel.

```typescript
yield * promptService.ensureMetadataOverwriteOrThrow({ uris });
```

## Handling Cancellations

### `UserCancellationError`

`Schema.TaggedError` for silent exits.

- **Silent**: `registerCommandWithLayer/Runtime` catch this and return `Effect.void` (no UI error).
- **Messages**: Only set `message` for trace/log details.

```typescript
// Silent exit
return yield * new UserCancellationError();

// Exit with log context
return yield * new UserCancellationError({ message: 'User cancelled overwrite' });
```

## Pattern: Wrapping Promises

Always wrap VS Code prompt promises in `Effect.promise`.

```typescript
const promptForTemplate = Effect.fn('promptForTemplate')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;

  return yield* Effect.promise(() =>
    vscode.window.showQuickPick(
      [
        { label: 'DefaultApexClass', description: '...' },
        { label: 'ApexException', description: '...' }
      ],
      { placeHolder: 'Select template' }
    )
  ).pipe(
    Effect.flatMap(promptService.considerUndefinedAsCancellation),
    Effect.map(choice => choice.label)
  );
});
```

## Template Helpers

Use `sfTemplateProjectHelpers.ts` for metadata generation.

### `promptForApexTypeName`

Validates Apex names.

```typescript
const className =
  yield *
  promptForApexTypeName({
    prompt: nls.localize('apex_class_name_prompt')
  });
```

- prompt text uses `apex_class_name_prompt`
- built-in validation strings: `apex_name_empty_error`, `apex_name_format_error`, `apex_class_name_max_length_error`, `apex_name_cannot_be_default`
- supply `messages` with localized overrides if you need custom copy or translations

### `promptForOutputDir`

Selects output dir. Pass `folderName` to BFS-search all package dirs for matching folders and present all as quick pick options (default first). Without `folderName`, shows only `defaultUri`.

```typescript
// With folderName — finds all 'classes' dirs across package directories
const outputDirUri = yield * promptService.promptForOutputDir({
  defaultUri,
  folderName: 'classes',
  pickerPlaceHolder: nls.localize('output_dir_prompt')
});

// Without folderName — shows only defaultUri
const outputDirUri = yield * promptService.promptForOutputDir({
  defaultUri,
  description: nls.localize('output_dir_description'),
  pickerPlaceHolder: nls.localize('output_dir_prompt')
});
```

Requires `ProjectService` + `WorkspaceService` in the layer (already in `PromptService.Default` dependencies).

### `getApiVersion`

Waterfall: `sfdx-project.json` → connection → fallback.

```typescript
const apiVersion = yield * getApiVersion(project);
```
