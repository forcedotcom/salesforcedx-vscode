---
name: ExtensionContextNotAvailableError fix
overview: The error occurs because `maybeUpdateDefaultOrgRef` in connectionService explicitly provides `ExtensionContextService.Default` (which always fails) when calling `setWebUserId`, overriding the consumer's valid ExtensionContextService from their layer.
todos: []
isProject: false
---

# ExtensionContextNotAvailableError Fix

## Root Cause

From the trace and code:

1. **Flow**: `provideTraceFlagsCodeLens` (CodeLens) → `TraceFlagService.getTraceFlagForUser` → `ConnectionService.getConnection` → `maybeUpdateDefaultOrgRef` → `setWebUserId`
2. **Ref usage**: The `SubscriptionRef` in [defaultOrgRef.ts](packages/salesforcedx-vscode-services/src/core/defaultOrgRef.ts) does **not** need ExtensionContext. It is in-memory.
3. **Actual need**: `setWebUserId` in [webUserId.ts](packages/salesforcedx-vscode-services/src/observability/webUserId.ts) needs ExtensionContext to persist the hashed user id for telemetry: `extensionContext.globalState.update(TELEMETRY_GLOBAL_WEB_USER_ID, webUserId)`.
4. **Bug**: In [connectionService.ts](packages/salesforcedx-vscode-services/src/core/connectionService.ts) line 296:

```typescript
yield * setWebUserId(orgId, userId).pipe(Effect.provide(ExtensionContextService.Default));
```

`Effect.provide(ExtensionContextService.Default)` replaces the ambient `ExtensionContextService` (from apex-log’s `ExtensionContextServiceLayer(context)`) with the Default implementation, which always fails with `ExtensionContextNotAvailableError`.

## Options

### Option A: Remove the `.provide()` (simplest)

- **Change**: Delete `Effect.provide(ExtensionContextService.Default)` so `setWebUserId` uses the ambient `ExtensionContextService` from the caller’s layer.
- **Result**: Works when a consumer (e.g. apex-log) provides `ExtensionContextServiceLayer(context)` in `buildAllServicesLayer`.
- **Trade-off**: `webUserId` is stored in the consumer extension’s `globalState`, not the services extension’s. Each consumer will store its own copy; telemetry user id may differ per extension.

### Option B: Use services extension context as fallback

- **Idea**: When no explicit layer provides context, fall back to the services extension’s context.
- **Steps**:
  1. In services `activate`, call `setExtensionContext(context)` from [extensionContext.ts](packages/salesforcedx-vscode-services/src/vscode/extensionContext.ts).
  2. Change `ExtensionContextService.Default` in [extensionContextService.ts](packages/salesforcedx-vscode-services/src/vscode/extensionContextService.ts) so it uses `getExtensionContext()` instead of failing.
  3. Remove `Effect.provide(ExtensionContextService.Default)` from connectionService so the environment decides which implementation to use.
- **Result**: If a consumer provides `ExtensionContextServiceLayer`, that is used. Otherwise, services’ context is used (single shared `webUserId` in services’ globalState).

### Option C: Remove `.provide()` and treat Default as “try services first”

- Keep Option B’s change to `ExtensionContextService.Default` (use `getExtensionContext()` when available).
- Remove `Effect.provide(ExtensionContextService.Default)` from connectionService.
- Default becomes: first check module-level services context, then fail. Consumers can still override via their layer.

## Recommendation

**Option B**:

- Fixes the CodeLens error by removing the override and allowing the ambient service to be used.
- Centralizes `webUserId` in the services extension when no consumer provides context.
- Reuses the existing `extensionContext.ts` / `setExtensionContext` pattern; it is not currently used anywhere but fits this need.

## Files to Change

- [packages/salesforcedx-vscode-services/src/index.ts](packages/salesforcedx-vscode-services/src/index.ts) – call `setExtensionContext(context)` early in `activate`
- [packages/salesforcedx-vscode-services/src/vscode/extensionContextService.ts](packages/salesforcedx-vscode-services/src/vscode/extensionContextService.ts) – make Default use `getExtensionContext()`
- [packages/salesforcedx-vscode-services/src/core/connectionService.ts](packages/salesforcedx-vscode-services/src/core/connectionService.ts) – remove `Effect.provide(ExtensionContextService.Default)` (delete the pipe; call `setWebUserId(orgId, userId)` directly)

## Verification

Per [verification SKILL](.claude/skills/verification/SKILL.md): compile, lint, test, bundle, knip, check:dupes.
