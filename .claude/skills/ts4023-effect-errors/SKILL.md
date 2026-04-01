---
name: ts4023-effect-errors
description: Fix TS4023 errors when exporting Effect-based functions. Use when TypeScript reports "has or is using name 'X' from external module but cannot be named" for Effect error types, or when knip flags error type exports as unused.
---

# TS4023 with Effect Error Types

## Problem

Exporting function returning `Effect` → TypeScript generates `.d.ts` → error types in Effect's error channel not exported from source package → TS4023.

**TS4023 message is misleading**: mentions internal Effect types (`Channel`, `Sink`, `Stream` from `effect/Cause`), not actual missing errors.

## Solution

Export ALL error types that appear in any Effect's error channel - including non-exported `class` definitions.

### 1. Find ALL TaggedError classes (not just exported ones)

```bash
# Find Data.TaggedError and Schema.TaggedError (both used in codebase)
rg "class \w+Error extends (Data|Schema)\.TaggedError" packages/salesforcedx-vscode-services/src
```

**Critical**: Include classes WITHOUT `export` keyword. Example:

```typescript
// This ALSO needs to be exported if used in any Effect's error channel
class EmptyComponentSetError extends Schema.TaggedError<EmptyComponentSetError>()('EmptyComponentSetError', {...}) {}
```

### 2. For non-exported errors, add export to source file first

```typescript
// Before
class EmptyComponentSetError extends Schema.TaggedError<EmptyComponentSetError>()('EmptyComponentSetError', {...}) {}

// After
export class EmptyComponentSetError extends Schema.TaggedError<EmptyComponentSetError>()('EmptyComponentSetError', {...}) {}
```

### 3. Then export from index.ts

```typescript
export type { EmptyComponentSetError } from './core/componentSetService';
```

### 4. Verify

```bash
npx tsc --build packages/salesforcedx-vscode-metadata --force
```

## Why non-exported errors matter

If a service method like `ensureNonEmptyComponentSet` can fail with `EmptyComponentSetError`, that error type appears in the Effect's error channel. Any exported function calling that method inherits the error in its type signature. TypeScript needs to name it in `.d.ts`.

## Knip false positives

Knip flags these as "unused exports" when the error class is defined and used within the same file but exported for TS4023 reasons. Fix by adding `/** @effectError */` JSDoc to the export:

```typescript
/** @effectError */
export class NoFilesRetrievedError extends Schema.TaggedError<NoFilesRetrievedError>()('NoFilesRetrievedError', {
  message: Schema.String
}) {}
```

`knip.json` is configured with `"tags": ["-effectError"]` which suppresses these from the report.

**Do NOT add `@effectError` to errors exported from `salesforcedx-vscode-services`** — those are consumed by other packages and knip correctly sees them as used.

## Checklist

- [ ] `rg "class.*TaggedError"` - find ALL errors (with AND without `export`)
- [ ] Add `export` to any non-exported error classes used in Effect chains
- [ ] Add `export type { ErrorName }` to services `index.ts`
- [ ] `npx tsc --build <package> --force` passes
- [ ] Ignore knip "unused" warnings for these exports
