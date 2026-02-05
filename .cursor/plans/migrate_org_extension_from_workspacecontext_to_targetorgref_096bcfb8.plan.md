---
name: Migrate org extension from WorkspaceContext to TargetOrgRef
overview: Replace WorkspaceContext and workspaceContextUtils usage in org extension with TargetOrgRef from services extension, requiring Effect-based architecture migration.
todos:
  - id: add-services-dependency
    content: Add salesforcedx-vscode-services to extensionDependencies and @salesforce/effect-ext-utils to dependencies in package.json
    status: pending
  - id: setup-effect-infrastructure
    content: Create extensionProvider.ts with buildAllServicesLayer and convert index.ts activate to Effect-based pattern
    status: pending
  - id: migrate-orgList
    content: Convert orgPicker/orgList.ts to use TargetOrgRef.changes instead of WorkspaceContext.onOrgChange
    status: pending
  - id: migrate-orgDecorator
    content: Convert decorators/orgDecorator.ts to use TargetOrgRef instead of WorkspaceContext and ConfigUtil.getTargetOrgOrAlias
    status: pending
  - id: migrate-orgDisplay
    content: Convert commands/orgDisplay.ts to use TargetOrgRef instead of getTargetOrgOrAlias
    status: pending
  - id: migrate-orgLogout
    content: Convert commands/auth/orgLogout.ts to use TargetOrgRef instead of getTargetOrgOrAlias
    status: pending
  - id: update-util-exports
    content: Remove or deprecate getTargetOrgOrAlias export from util/index.ts
    status: pending
  - id: move-createTable
    content: Move createTable from salesforcedx-utils-vscode to effect-ext-utils and update org extension imports
    status: pending
isProject: false
---

# Migrate org extension from WorkspaceContext to TargetOrgRef

## Current State

**WorkspaceContext usage:**

- `packages/salesforcedx-vscode-org/src/orgPicker/orgList.ts` - listens to `WorkspaceContext.getInstance().onOrgChange()` and reads `username`/`alias`
- `packages/salesforcedx-vscode-org/src/decorators/orgDecorator.ts` - listens to `WorkspaceContext.getInstance().onOrgChange()`

**getTargetOrgOrAlias usage:**

- `packages/salesforcedx-vscode-org/src/util/index.ts` - re-exports from utils-vscode
- `packages/salesforcedx-vscode-org/src/commands/orgDisplay.ts` - uses `getTargetOrgOrAlias(true)`
- `packages/salesforcedx-vscode-org/src/commands/auth/orgLogout.ts` - uses `getTargetOrgOrAlias(false)`
- `packages/salesforcedx-vscode-org/src/decorators/orgDecorator.ts` - uses `ConfigUtil.getTargetOrgOrAlias()`

**createTable usage:**

- `packages/salesforcedx-vscode-org/src/commands/orgDisplay.ts` - uses `createTable` from utils-vscode
- `packages/salesforcedx-vscode-org/src/commands/orgList.ts` - uses `createTable` from utils-vscode
- `packages/salesforcedx-vscode-org/src/commands/configSet.ts` - uses `createTable` from utils-vscode

**Architecture:**

- Org extension is imperative (no Effect)
- Depends on `salesforcedx-vscode-core` extension
- Uses `@salesforce/salesforcedx-utils-vscode` for `getTargetOrgOrAlias`

## Required Changes

### 1. Add services extension dependency

**File:** `packages/salesforcedx-vscode-org/package.json`

- Add `salesforcedx-vscode-services` to `extensionDependencies`
- Add `@salesforce/effect-ext-utils` to `dependencies` (if not present)

### 2. Set up Effect infrastructure

**New file:** `packages/salesforcedx-vscode-org/src/extensionProvider.ts`

- Create `buildAllServicesLayer(context)` following services-extension-consumption pattern
- Include: `ExtensionContextServiceLayer`, `ChannelServiceLayer`, `TargetOrgRef`, `ConnectionService`, `ProjectService`, `WorkspaceService`
- Create `AllServicesLayer` variable

**File:** `packages/salesforcedx-vscode-org/src/index.ts`

- Convert `activate` to Effect-based pattern
- Use `ExtensionProviderService` to get services API
- Set up `AllServicesLayer` with `buildAllServicesLayer(context)`
- Use `Effect.runPromise` with proper scope management

### 3. Replace WorkspaceContext.onOrgChange with TargetOrgRef.changes

**File:** `packages/salesforcedx-vscode-org/src/orgPicker/orgList.ts`

- Convert `OrgList` class to Effect-based initialization
- Replace `WorkspaceContext.getInstance().onOrgChange()` with:
  ```typescript
  const targetOrgRef = yield * api.services.TargetOrgRef();
  yield *
    Effect.forkDaemon(
      Stream.merge(Stream.fromEffect(SubscriptionRef.get(targetOrgRef)), targetOrgRef.changes).pipe(
        Stream.tap(orgInfo => displayTargetOrg(orgInfo.username ?? orgInfo.alias)),
        Stream.runForEach(() => Effect.void)
      )
    );
  ```
- Get initial value from `SubscriptionRef.get(targetOrgRef)` instead of `WorkspaceContext.getInstance()`
- Use `orgInfo.username` or `orgInfo.alias` from DefaultOrgInfoSchema

**File:** `packages/salesforcedx-vscode-org/src/decorators/orgDecorator.ts`

- Convert `OrgDecorator` class to Effect-based initialization
- Replace `WorkspaceContext.getInstance().onOrgChange()` with same TargetOrgRef pattern
- Replace `ConfigUtil.getTargetOrgOrAlias()` with reading from `targetOrgRef`:
  ```typescript
  const orgInfo = yield * SubscriptionRef.get(targetOrgRef);
  const targetOrgOrAlias = orgInfo.username ?? orgInfo.alias;
  ```

### 4. Replace getTargetOrgOrAlias calls

**File:** `packages/salesforcedx-vscode-org/src/commands/orgDisplay.ts`

- Convert command to Effect-based using `registerCommandWithLayer`
- Replace `getTargetOrgOrAlias(true)` with:
  ```typescript
  const targetOrgRef = yield * api.services.TargetOrgRef();
  const orgInfo = yield * SubscriptionRef.get(targetOrgRef);
  const targetOrgOrAlias = orgInfo.username;
  ```
- Handle missing org case (show warning if `enableWarning` was true)

**File:** `packages/salesforcedx-vscode-org/src/commands/auth/orgLogout.ts`

- Convert command to Effect-based
- Replace `getTargetOrgOrAlias(false)` with same TargetOrgRef pattern
- Use `orgInfo.username` from ref

**File:** `packages/salesforcedx-vscode-org/src/util/index.ts`

- Remove `getTargetOrgOrAlias` export (or mark deprecated)
- Update callers to use TargetOrgRef instead

### 5. Update initialization pattern

**File:** `packages/salesforcedx-vscode-org/src/index.ts`

- Convert `initializeOrgPicker` to Effect:

  ```typescript
  const initializeOrgPicker = Effect.gen(function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const registerCommand = api.services.registerCommandWithLayer(AllServicesLayer);

    const orgListEffect = createOrgListEffect(); // returns Effect<OrgList>
    const orgDecoratorEffect = createOrgDecoratorEffect(); // returns Effect<OrgDecorator>

    const [orgList, orgDecorator] = yield* Effect.all([orgListEffect, orgDecoratorEffect]);
    // Register commands, set up watchers, etc.
  });
  ```

### 6. Handle alias resolution

**Note:** `DefaultOrgInfoSchema` has `username` but not explicit `alias`. The `username` field may contain alias or resolved username. If alias resolution is needed:

- Use `AuthInfo` from `@salesforce/core` to resolve alias to username
- Or use sfdx-core's `Alias` class (via `StateAggregator.getInstance().aliases.resolveUsername()`)

**Note:** Core extension dependency must remain for `taskViewService` (used in `orgOpen.ts` and `orgCreate.ts`) and `SalesforceProjectConfig` (used in `authParamsGatherer.ts` for `sfdcLoginUrl`).

### 7. Move createTable to effect-ext-utils

**New file:** `packages/effect-ext-utils/src/table.ts`

- Copy `createTable`, `calculateMaxColumnWidths`, `Row`, `Column` types, and helper functions from `packages/salesforcedx-utils-vscode/src/output/table.ts`
- Export from `packages/effect-ext-utils/src/index.ts`

**File:** `packages/salesforcedx-vscode-org/src/commands/orgDisplay.ts`

- Update import: `import { createTable, Column, Row } from '@salesforce/effect-ext-utils'`
- Remove import from `@salesforce/salesforcedx-utils-vscode`

**File:** `packages/salesforcedx-vscode-org/src/commands/orgList.ts`

- Update import: `import { createTable, Column, Row } from '@salesforce/effect-ext-utils'`
- Remove import from `@salesforcedx-utils-vscode`

**File:** `packages/salesforcedx-vscode-org/src/commands/configSet.ts`

- Update import: `import { createTable, Column, Row } from '@salesforce/effect-ext-utils'`
- Remove import from `@salesforcedx-utils-vscode`

**File:** `packages/salesforcedx-utils-vscode/src/index.ts`

- Remove `createTable`, `Column`, `Row` exports (or mark deprecated)

**Note:** Other extensions using `createTable` (e.g., `salesforcedx-vscode-soql`, `salesforcedx-vscode-core`) can be migrated separately.

## Testing Considerations

- Test org change events fire correctly
- Test status bar updates on org change
- Test commands work with TargetOrgRef
- Test alias vs username handling
- Test web vs desktop environments (TargetOrgRef handles both)

## Migration Order

1. Move `createTable` to effect-ext-utils (can be done independently)
2. Add services dependency + Effect setup
3. Convert one file at a time (start with simpler ones)
4. Update org extension imports to use `createTable` from effect-ext-utils
5. Test after each conversion
6. Remove WorkspaceContext usage last
7. Core dependency remains for `taskViewService` and `SalesforceProjectConfig`
