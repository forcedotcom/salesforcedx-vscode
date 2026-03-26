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

Selects metadata package folder (apex classes/triggers, etc.).

```typescript
const outputDirUri = yield * promptForOutputDir(project, 'classes', 'Select output directory');
```

### `getApiVersion`

Waterfall: `sfdx-project.json` → connection → fallback.

```typescript
const apiVersion = yield * getApiVersion(project);
```
