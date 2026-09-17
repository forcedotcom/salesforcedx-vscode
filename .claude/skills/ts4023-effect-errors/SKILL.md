---
name: ts4023-effect-errors
description: Fix TS4023 when an exported Effect's error channel names a TaggedError from another module. Use when tsc reports "has or is using name 'X' from external module but cannot be named".
review: never
---

# TS4023 with Effect Error Types

TS4023 = exported Effect `.d.ts` names an error from **another module** that did not export it. Typical: a services method error leaks into a consumer command.

Export only that class. Same-file, `catchTag`'d, or absent from an **exported** signature → leave unexported (`OrgNotDeletableError`, `ToastActionError`).

**TS4023 message is misleading**: cites Effect internals (`Channel`, `Sink`, `Stream` from `effect/Cause`), not the missing error.

## Fix (defining module → consumer)

1. Find unexported TaggedErrors in the defining package (usually services):

```bash
rg "class \w+Error extends (Data|Schema)\.TaggedError" packages/salesforcedx-vscode-services/src
```

2. `export` the class that appears in the failing Effect's error channel:

```typescript
export class EmptyComponentSetError extends Schema.TaggedError<EmptyComponentSetError>()('EmptyComponentSetError', {...}) {}
```

3. Services public API — re-export from `index.ts`:

```typescript
export type { EmptyComponentSetError } from './core/componentSetService';
```

4. Compile the **consumer** that failed:

```bash
npm run compile -w packages/salesforcedx-vscode-metadata
```

## Knip after a required same-package export

TS4023 required `export` in a non-services package, knip flags it unused → tag:

```typescript
/** @ExportTaggedError */
export class NoFilesRetrievedError extends Schema.TaggedError<NoFilesRetrievedError>()('NoFilesRetrievedError', {
  message: Schema.String
}) {}
```

Knip unused on a TaggedError with no TS4023 → unexport; do not tag.

Services errors are imported by other packages; knip already sees them used. No `@ExportTaggedError` there (`no-export-tagged-error-in-services`).

## Checklist

- [ ] TS4023 actually reported
- [ ] Export only the class in the exported Effect's error channel
- [ ] Services: `export type { ErrorName }` from `index.ts`
- [ ] Consumer compile passes
- [ ] `@ExportTaggedError` only if knip flags that export unused (never in services)
