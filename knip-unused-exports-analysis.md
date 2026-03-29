# Knip Unused Exports Analysis

**Date**: 2026-03-28
**Total unused exports**: 39
**Total unused exported types**: 15

## Summary by Category

| Category | Count | Action |
|----------|-------|--------|
| 🔴 Truly Dead (Remove) | 17 | Can safely remove |
| 🟡 Used in `__tests__` (Config Issue) | 6 | Fix knip config |
| 🟢 Used Only in Same File | 1 | Un-export (make private) |
| 🔵 Duplicate Definitions | 1 | Remove duplicate |
| 🟣 Unused Effect Layers | 2 | Review if needed for DI |
| ⚪ Needs Investigation | 27 | Manual review required |

---

## 🔴 Category 1: Truly Dead Code (High Confidence)

These exports are **never imported or used** anywhere in the codebase. Safe to remove.

### Constants

1. **`APEX_TRIGGER_DIRECTORY`** - `packages/salesforcedx-vscode-core/src/commands/templates/metadataTypeConstants.ts:7`
   - Never used, can remove

2. **`APEX_TRIGGER_TYPE`** - `packages/salesforcedx-vscode-core/src/commands/templates/metadataTypeConstants.ts:8`
   - Never used, can remove

3. **`APEX_TRIGGER_NAME_MAX_LENGTH`** - `packages/salesforcedx-vscode-core/src/commands/templates/metadataTypeConstants.ts:9`
   - Never used, can remove

4. **`VSCODE_APEX_EXTENSION_NAME`** - `packages/salesforcedx-vscode-apex/src/constants.ts:14`
   - Never used, can remove

5. **`IS_TEST_REG_EXP`** (apex) - `packages/salesforcedx-vscode-apex/src/constants.ts:22`
   - Never used, can remove

6. **`IS_CLS_OR_TRIGGER`** - `packages/salesforcedx-vscode-apex/src/constants.ts:23`
   - Never used, can remove

7. **`APEX_CLASS_NAME_MAX_LENGTH`** (apex-testing) - `packages/salesforcedx-vscode-apex-testing/src/constants.ts:8`
   - Never used, can remove
   - NOTE: There's a duplicate in metadata package that IS used

8. **`APEX_TESTSUITE_EXT`** - `packages/salesforcedx-vscode-apex-testing/src/constants.ts:14`
   - Never used, can remove

9. **`APEX_CLASS_NAME_MAX_LENGTH`** (metadata) - `packages/salesforcedx-vscode-metadata/src/constants.ts:10`
   - Never used, can remove

### Functions

10. **`isVSCodeWeb`** - `packages/playwright-vscode-ext/src/utils/helpers.ts:302`
    - Never called, can remove

11. **`enableMonacoAutoClosing`** - `packages/playwright-vscode-ext/src/utils/helpers.ts:340`
    - Never called, can remove
    - Has counterpart `disableMonacoAutoClosing` that IS used

12. **`clearProblemsFilter`** - `packages/playwright-vscode-ext/src/pages/problems.ts:36`
    - Never called, can remove

13. **`getTestInfo`** - `packages/salesforcedx-vscode-apex-testing/src/utils/fileHelpers.ts:30`
    - Never called, can remove

14. **`sharedUriConverters`** - `packages/salesforcedx-vscode-lwc/src/languageClient/clientOptions.ts:35`
    - Never used, can remove

15. **`operatorOptions`** - `packages/salesforcedx-vscode-soql/src/soql-builder-ui/modules/querybuilder/services/model.ts:60`
    - Never used, can remove

### Span/Telemetry Functions

16. **`isTopLevelSpan`** - `packages/salesforcedx-vscode-services/src/observability/spanUtils.ts:11`
    - Used internally in `isSpanValidForProductionTelemetry` but never imported elsewhere
    - Can un-export or remove if parent function handles it

17. **`isCommandSpan`** - `packages/salesforcedx-vscode-services/src/observability/spanUtils.ts:14`
    - Used internally in `isSpanValidForProductionTelemetry` but never imported elsewhere
    - Can un-export or remove if parent function handles it

18. **`isTelemetryIgnored`** - `packages/salesforcedx-vscode-services/src/observability/spanUtils.ts:17`
    - Used internally in `isSpanValidForProductionTelemetry` but never imported elsewhere
    - Can un-export or remove if parent function handles it

### Error Classes

19. **`DeleteSourceConflictError`** - `packages/salesforcedx-vscode-metadata/src/shared/delete/deleteErrors.ts:11`
    - ✅ **Verified never imported or instantiated**
    - Effect TaggedError that's defined but never used
    - Safe to remove

### Virtual File System

20. **`isItReadOnlyEffect`** - `packages/salesforcedx-vscode-services/src/virtualFsProvider/fileSystemProvider.ts:47`
    - Never used, can remove

---

## 🟡 Category 2: Used in `__tests__` Directories (Config Issue)

These are flagged as unused because knip ignores `**/__tests__/**`. Need to fix `.knip.json`.

### Aura Language Server - Tern Server

1. **`init`** - `packages/salesforcedx-aura-language-server/src/tern-server/ternServer.ts:183`
   - Used in: `src/tern-server/__tests__/ternCompletion.spec.ts`

2. **`startServer`** - `packages/salesforcedx-aura-language-server/src/tern-server/ternServer.ts:185`
   - Used in: `src/tern-server/__tests__/ternCompletion.spec.ts`

3. **`addFile`** - `packages/salesforcedx-aura-language-server/src/tern-server/ternServer.ts:311`
   - Used in: `src/tern-server/__tests__/ternCompletion.spec.ts`

4. **`delFile`** - `packages/salesforcedx-aura-language-server/src/tern-server/ternServer.ts:316`
   - Used in: `src/tern-server/__tests__/ternCompletion.spec.ts`

5. **`onTypeDefinition`** - `packages/salesforcedx-aura-language-server/src/tern-server/ternServer.ts:387`
   - Used in: `src/tern-server/__tests__/ternCompletion.spec.ts`

6. **`onSignatureHelp`** - `packages/salesforcedx-aura-language-server/src/tern-server/ternServer.ts:471`
   - Used in: `src/tern-server/__tests__/ternCompletion.spec.ts`

**Fix**: Update `.knip.json` to include `__tests__` directories in `entry` or `project`:
```json
"packages/salesforcedx-aura-language-server": {
  "entry": ["src/index.ts", "src/**/__tests__/**/*.spec.ts"]
}
```

---

## 🟢 Category 3: Used Only in Same File (Can Un-export)

1. **`CheckpointNode`** (class) - `packages/salesforcedx-vscode-apex-replay-debugger/src/breakpoints/checkpointService.ts:221`
   - Used 17 times in the same file
   - Never imported by other files
   - **Action**: Remove `export` keyword, make it file-private

---

## 🔵 Category 4: Duplicate Definitions

1. **`NoWorkspaceOpenError`** - `packages/salesforcedx-vscode-services/src/core/projectService.ts:160`
   - ⚠️ **DUPLICATE!** Another class with same name exists at:
     - `packages/salesforcedx-vscode-services/src/vscode/workspaceService.ts:65` (USED)
   - The one in projectService.ts is never used
   - **Action**: Remove the unused duplicate from projectService.ts

---

## 🟣 Category 5: Unused Effect Service Layers

These are Effect dependency injection layers that are exported but never imported.

1. **`AllServicesLayer`** - `packages/salesforcedx-vscode-apex-log/src/services/extensionProvider.ts:58`
   - Effect Layer export, never imported
   - Re-exported from `./allServicesLayerRef`
   - **Question**: Is this intended for future external use or testing?

2. **`AllServicesLayer`** - `packages/salesforcedx-vscode-apex-testing/src/services/extensionProvider.ts:64`
   - Effect Layer export, never imported
   - Re-exported from local module
   - **Question**: Is this intended for future external use or testing?

**Recommendation**: If not needed for external consumption, un-export these. If they're part of a public API for other extensions, keep them.

---

## ⚪ Category 6: Needs Investigation

These require manual review to determine if they're truly unused or if there's dynamic usage.

### Aura Language Server Utils

1. **`getAuraBindingTemplateDe…`** (truncated) - `packages/salesforcedx-aura-language-server/src/auraUtils.ts:159`
2. **`isAuraWatchedDirectory`** - `packages/salesforcedx-aura-language-server/src/auraUtils.ts:379`
3. **`isAuraRootDirectoryCreat…`** (truncated) - `packages/salesforcedx-aura-language-server/src/auraUtils.ts:384`

### Lightning LSP Common

4. **`getEmptyDirectoryListing`** - `packages/salesforcedx-lightning-lsp-common/src/providers/lspFileSystemAccessor.ts:40`
5. **`uriToNormalizedPath`** - `packages/salesforcedx-lightning-lsp-common/src/providers/lspFileSystemAccessor.ts:46`
6. **`getFileUriForPath`** - `packages/salesforcedx-lightning-lsp-common/src/providers/lspFileSystemAccessor.ts:82`

### Error Classes

7. **`NoFilesRetrievedError`** (class) - `packages/salesforcedx-vscode-org-browser/src/services/orgBrowserMetadataRetrieveService.ts:15`
   - Effect error class, check if used in catchTag

### Service/Schema Exports

8. **`DebugLevelItemSchema`** - `packages/salesforcedx-vscode-services/src/core/traceFlagService.ts:38:10`
9. **`TraceFlagLogType`** - `packages/salesforcedx-vscode-services/src/core/traceFlagService.ts:38:53`

### Org Browser Services

10. **`extensionProviderService`** - `packages/salesforcedx-vscode-org-browser/src/services/extensionProviderService.ts`
    - Entire file flagged as unused

---

## 📊 Unused Exported Types (15)

Types are generally lower risk to keep, but can clutter autocomplete. Review these:

1. **`ActionScriptType`** - `packages/salesforcedx-apex-replay-debugger/src/commands/index.ts:7`
2. **`WorkspaceReadFileCli…`** - `packages/salesforcedx-lightning-lsp-common/src/workspaceReadFileHandler.ts:36`
3. **`MessageKey`** (lwc-language-server) - `packages/salesforcedx-lwc-language-server/src/messages/i18n.ts:22`
4. **`LogCollectorState`** - `packages/salesforcedx-vscode-apex-log/src/services/apexLogState.ts:13`
5. **`TraceFlagsContentPro…`** - `packages/salesforcedx-vscode-apex-log/src/traceFlags/traceFlagsContentProvider.ts:122`
6. **`ProjectTemplate`** - `packages/salesforcedx-vscode-core/src/commands/projectGenerate.ts:83`
7. **`FileNameParameter`** - `packages/salesforcedx-vscode-core/src/commands/util/parameterGatherers.ts:23`
8. **`OutputDirParameter`** - `packages/salesforcedx-vscode-core/src/commands/util/parameterGatherers.ts:27`
9. **`MetadataTypeParameter`** - `packages/salesforcedx-vscode-core/src/commands/util/parameterGatherers.ts:31`
10. **`MessageKey`** (metadata) - `packages/salesforcedx-vscode-metadata/src/messages/index.ts:15`
11. **`OrgQuickPickItem`** - `packages/salesforcedx-vscode-org/src/orgPicker/orgList.ts:69`
12. **`QueryAndApiInputs`** - `packages/salesforcedx-vscode-soql/src/commands/queryUtils.ts:14`
13. **`OperatorOption`** - `packages/salesforcedx-vscode-soql/src/soql-builder-ui/modules/querybuilder/services/model.ts:53`
14. **`MessageKey`** (soql) - `packages/salesforcedx-vscode-soql/src/soql-model/messages/i18n.ts:71`
15. **`LiteralType`** - `packages/salesforcedx-vscode-soql/src/soql-model/model/model.ts:203`

---

## 🎯 Recommended Action Plan

### Phase 1: Quick Wins (Low Risk)
1. Remove 17 truly dead exports (constants, functions)
2. Remove duplicate `NoWorkspaceOpenError` from projectService.ts
3. Un-export `CheckpointNode` class

**Impact**: Clean up 19 unused exports immediately

### Phase 2: Fix Knip Config
1. Update `.knip.json` to include `__tests__` in entry points:
```json
"packages/*": {
  "entry": [
    "src/index.ts",
    "test/**/*.test.ts",
    "test/**/*.spec.ts",
    "src/**/__tests__/**/*.spec.ts"  // Add this
  ]
}
```

**Impact**: Correctly identify 6 exports as used

### Phase 3: Manual Review
1. Check Aura/Lightning LSP exports (9 items)
2. Review unused types (15 items)
3. Decide on Effect service layers (2 items)

**Impact**: Final cleanup after investigation

---

## 📝 Notes

- **Effect-TS Error Classes**: Some error classes (like `DeleteSourceConflictError`) are defined but never used. In Effect, errors can be caught by tag name, so check for `catchTag('ErrorName')` patterns.

- **Test Files**: The current `.knip.json` ignores `**/__tests__/**`, causing false positives. Consider including these directories in `project` or `entry` patterns.

- **Constants Duplication**: There are multiple `APEX_CLASS_NAME_MAX_LENGTH` constants across packages. Consider consolidating to a shared constants package.

- **Public API**: For utility packages like `salesforcedx-utils` or `effect-ext-utils`, some exports might be intentionally public for external consumption even if not used internally.
