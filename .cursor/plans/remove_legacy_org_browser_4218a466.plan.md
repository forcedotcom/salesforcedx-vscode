---
name: Remove legacy org browser
overview: Remove the legacy org browser from salesforcedx-vscode-core, remove the toggle setting, and make the new org browser in salesforcedx-vscode-org-browser the only implementation. Addresses a few feature gaps first.
todos:
  - id: refresh-cache
    content: Fix refresh to actually invalidate cache (invalidation methods on service, refreshType calls them)
    status: completed
  - id: delete-old-source
    content: Delete orgBrowser/ dir and commands/retrieveMetadata/ dir from core
    status: pending
  - id: cleanup-core-index
    content: Remove setupOrgBrowser function, orgBrowser imports, and call site from core's index.ts
    status: pending
  - id: cleanup-core-settings
    content: Remove USE_LEGACY_ORG_BROWSER constant and getUseLegacyOrgBrowser() method
    status: pending
  - id: cleanup-core-packagejson
    content: Remove metadata view/container, old commands, old menus, old setting, walkthrough from core package.json + nls
    status: pending
  - id: remove-toggle-new
    content: Remove when clause from org-browser view and early-exit guard from org-browser activation
    status: pending
  - id: update-e2e-tests
    content: Delete or rewrite orgBrowser.e2e.ts automation test
    status: pending
  - id: verify
    content: Run compile, lint, effect LS, test, bundle, test:web, test:desktop (org-browser + affected), knip, check:dupes
    status: pending
isProject: false
---

# Remove Legacy Org Browser and Make New Org Browser the Default

## Old vs New: Feature Comparison

### Things the new org browser does BETTER

- **File presence indicators**: Shows pass-filled/circle-outline icons for whether a component exists locally. Old has no equivalent.
- **Effect-TS architecture**: Proper service layers, managed runtime, structured error handling.
- **In-memory caching** with TTL (5-30 min) vs old file-based JSON caching.
- **Custom object fields**: Correct `Object__c.Field__c` fullNames suitable for retrieve. Old used display strings.
- **Collapse All**: New has it; old does not.
- **Overwrite confirmation**: New shows count of components that will be overwritten. Old used a generic modal.

### Gaps in the new org browser (need fixing before migration)

1. **Refresh cache invalidation**: `refreshType()` fires `onDidChangeTreeData` but never passes `refresh=true` to the cache, so the refresh button re-renders stale data. Old file-based cache actually re-fetches.
2. **No walkthrough**: Old contributes a 3-step walkthrough (`sf.org-browser`) in core's [package.json](packages/salesforcedx-vscode-core/package.json) lines 895-931. New has none.

### Intentional omissions (acceptable to drop)

- **Folder/folderType retrieve**: Metadata API doesn't support retrieve with `*` for folder types. New org browser correctly disables retrieve for `folder` and `folderType` nodes (menu `when` clause only shows retrieve for `type`, `customObject`, `component`). `getRetrieveMembers` returns `[]` for those nodes; no changes needed.
- **Separate "Retrieve and Open" command**: New auto-opens when retrieving a single component (`members.length === 1`). Same UX, one fewer button.
- **Separate component-level refresh command**: New uses a single `refreshType` that works on any expandable node.
- **Org root node**: Old had an `Org` node at the root. New starts directly with metadata types -- cleaner.
- **EmptyNode / "No components available"**: New shows nothing for empty types (VS Code's tree handles this natively with the welcome content).

## Migration Plan

### Phase 1: Fix gaps in the new org browser

#### 1. Fix refresh cache invalidation

**Problem:** `refreshType` fires `onDidChangeTreeData` but VS Code's `TreeDataProvider.getChildren(element?)` only ever passes one arg, so the `refresh` param (default `false`) is never `true`. Cache is never invalidated.

**Fix — separate invalidation methods on the service (SRP):**

1. Add three invalidation methods to `MetadataDescribeService`:

- `invalidateDescribe()` — invalidates `describeCache`
- `invalidateListMetadata(type, folder?)` — invalidates `listMetadataCache` entry
- `invalidateSObjectDescribe(objectName)` — invalidates `sobjectDescribeCache` entry

1. Remove `forceRefresh` param from `describe()` and `listMetadata()` — dead code (never reached via VS Code's `getChildren`).
2. Remove `refresh` param from `getChildrenOfTreeItem` and `getChildren`.
3. `refreshType(node)` runs an Effect that resolves the service and calls the right invalidation based on `node.kind`, then fires `onDidChangeTreeData(node)`. No flag needed.

**Node kind → invalidation mapping:**

- `undefined` (root/title bar) → `invalidateDescribe()`
- `type` → `invalidateListMetadata(xmlName)`
- `folderType` → `invalidateListMetadata(xmlName + 'Folder')`
- `folder` → `invalidateListMetadata(xmlName, folderName)`
- `customObject` → `invalidateSObjectDescribe(objectName)`

**Files:**

- [metadataDescribeService.ts](packages/salesforcedx-vscode-services/src/core/metadataDescribeService.ts): add invalidation methods, remove `forceRefresh` params
- [metadataTypeTreeProvider.ts](packages/salesforcedx-vscode-org-browser/src/tree/metadataTypeTreeProvider.ts): `refreshType` calls invalidation, remove `refresh` plumbing

### Phase 2: Remove legacy org browser from core

#### 2a. Delete old source files

- `packages/salesforcedx-vscode-core/src/orgBrowser/` (6 files: `browser.ts`, `index.ts`, `metadataCmp.ts`, `metadataOutlineProvider.ts`, `metadataType.ts`, `nodeTypes.ts`)
- `packages/salesforcedx-vscode-core/src/commands/retrieveMetadata/` (7 files: `componentNodeDescriber.ts`, `libraryRetrieveSourcePathExecutor.ts`, `nodeDescriber.ts`, `retrieveComponent.ts`, `retrieveDescriber.ts`, `retrieveDescriberFactory.ts`, `typeNodeDescriber.ts`)
- Verify: `packages/salesforcedx-vscode-core/src/commands/retrieveMetadata/retrieveMetadataTrigger.ts` -- check if it's also only used by the old org browser

#### 2b. Clean up core's index.ts

- Remove `import { orgBrowser } from './orgBrowser'` ([index.ts](packages/salesforcedx-vscode-core/src/index.ts) line 76)
- Remove `import { retrieveComponent, RetrieveMetadataTrigger }`
- Remove the entire `setupOrgBrowser` function (lines 154-176)
- Remove the call to `setupOrgBrowser` from `activate()`

#### 2c. Clean up core's constants and settings

- Remove `USE_LEGACY_ORG_BROWSER` from [constants.ts](packages/salesforcedx-vscode-core/src/constants.ts) line 34
- Remove `getUseLegacyOrgBrowser()` from [salesforceCoreSettings.ts](packages/salesforcedx-vscode-core/src/settings/salesforceCoreSettings.ts) lines 106-108

#### 2d. Clean up core's package.json

From [package.json](packages/salesforcedx-vscode-core/package.json):

- Remove the `metadata` view container (line 204-208) -- keep `conflicts` container
- Remove the `metadata` view (lines 217-223)
- Remove menu entries scoped to `view == metadata` (lines 234-255): `sf.metadata.view.type.refresh`, `sf.metadata.view.component.refresh`, `sf.retrieve.component`, `sf.retrieve.open.component`
- Remove command palette `when: false` entries for `sf.retrieve.component` and `sf.retrieve.open.component` (lines 468-474)
- Remove command palette entries for `sf.metadata.view.type.refresh` and `sf.metadata.view.component.refresh` (lines 560-566)
- Remove command definitions for all 4 old commands (lines 715-745)
- Remove the `useLegacyOrgBrowser` setting (lines 838-842)
- Remove the `sf.org-browser` walkthrough (lines 895-931) OR update it to reference the new org browser commands

#### 2e. Clean up core's package.nls.json

Remove i18n keys for the removed commands, setting description, and walkthrough strings.

### Phase 3: Remove toggle from the new org browser

#### 3a. Remove `when` clause from org-browser's view

In [org-browser package.json](packages/salesforcedx-vscode-org-browser/package.json) line 250, remove `"when": "!config.salesforcedx-vscode-core.useLegacyOrgBrowser"` so the view always shows.

#### 3b. Remove early-exit guard in activation

In [org-browser index.ts](packages/salesforcedx-vscode-org-browser/src/index.ts) lines 24-30, remove the `useLegacyOrgBrowser` check that exits early.

### Phase 4: Update automation tests

#### 4a. Update or remove legacy e2e test

[orgBrowser.e2e.ts](packages/salesforcedx-vscode-automation-tests/test/specs/orgBrowser.e2e.ts) sets `useLegacyOrgBrowser: true` and tests the old org browser. Either:

- Delete it (the new org browser has its own Playwright tests), or
- Rewrite it to test the new org browser (remove the setting toggle, update selectors)

### Phase 5: Move walkthrough to org-browser package (optional)

Move the `sf.org-browser` walkthrough from core to org-browser package. Update content for the new org browser:

**Step 1 — Open Org Browser**

- Open via cloud icon in Primary Sidebar → metadata container (same `workbench.view.extension.metadata`).
- New: in-memory cache with TTL (5–30 min); no `.sfdx` file-based cache.

**Step 2 — Browse and Refresh**

- Metadata types at root; expand to see components.
- Folder types (Report, Dashboard, Document, EmailTemplate): expand type → folders → components.
- File presence: pass-filled icon = exists locally; circle-outline = not in project.
- Custom Object fields: show `Object__c.Field__c` fullNames.
- Refresh: inline icon on type/folderType/folder; Collapse All in title bar.

**Step 3 — Retrieve**

- Retrieve icon on: type (all components), customObject (all fields), component (single).
- No retrieve on folderType or folder nodes (API doesn't support `*`); retrieve individual components inside folders.
- Overwrite confirmation shows count of components to overwrite.
- Single-component retrieve auto-opens the file.

**Assets**: Move `images/walkthrough/org-browser.png` from core to org-browser; update or replace if UI differs. Add nls keys to org-browser's package.nls.json.

### Phase 6: Verification

Per [verification skill](/.claude/skills/verification/SKILL.md):

1. `npm run compile`
2. `npm run lint`
3. `npx effect-language-service diagnostics --project tsconfig.json` (or `--file` for affected packages) — fix reported issues; read_lints does not surface Effect LS
4. `npm run test`
5. `npm run vscode:bundle`
6. E2E: `npm run test:web -w salesforcedx-vscode-org-browser -- --retries 0`, then `npm run test:desktop -w salesforcedx-vscode-org-browser -- --retries 0`. If core/services changed: run their test:web/test:desktop as well.
7. `npx knip`
8. `npm run check:dupes`
