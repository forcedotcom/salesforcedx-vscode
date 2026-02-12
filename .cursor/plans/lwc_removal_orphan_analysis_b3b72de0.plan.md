---
name: LWC Removal Orphan Analysis
overview: 'Analysis of utils and vscode-utils consumption after LWC preview command removal. Findings: no utils/vscode-utils exports became single-consumer; WorkspaceUtils in LWC is orphaned; nameFromFile/nameFromDirectory in aura-language-server lost their only external consumer.'
todos: []
isProject: false
---

# LWC Removal - Orphaned Utils Analysis

## Summary

**No** exports from `@salesforce/salesforcedx-utils` or `@salesforce/salesforcedx-utils-vscode` became single-extension-only after the LWC preview commands removal. All symbols the removed code used are still consumed by multiple extensions.

There are two orphaned pieces, both **outside** utils/vscode-utils:

1. **WorkspaceUtils** (in LWC extension itself) - now effectively dead
2. **nameFromFile / nameFromDirectory** (aura-language-server exports) - lost their only external consumer

---

## What the Removed Code Used

| Source                                                              | Symbols                                                                                                                                                                                                                              |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@salesforce/salesforcedx-utils-vscode`                             | notificationService, CliCommandExecutor, EmptyParametersGatherer, isSFContainerMode, SfCommandlet, SfWorkspaceChecker, stat, readFile, fileOrFolderExists, TimingUtils, ProgressNotification, SfCommandletExecutor, ContinueResponse |
| `@salesforce/salesforcedx-utils`                                    | Command, SfCommandBuilder, CommandOutput                                                                                                                                                                                             |
| `@salesforce/salesforcedx-aura-language-server/utils/componentUtil` | nameFromFile, nameFromDirectory                                                                                                                                                                                                      |
| LWC internal                                                        | WorkspaceUtils (via previewService)                                                                                                                                                                                                  |

---

## Utils / Vscode-Utils: All Multi-Consumer

Every symbol above from utils and utils-vscode is used by 3+ packages:

- **org**: orgOpen, orgCreate, orgDelete, orgList, orgDisplay, auth commands (CliCommandExecutor, SfCommandlet, isSFContainerMode, etc.)
- **core**: sfCommandletExecutor, refreshSObjects, metadataDocumentationService, projectGenerate, etc.
- **apex-debugger**: bootstrapCmd, debuggerStop (Command, SfCommandBuilder, fileOrFolderExists, etc.)
- **apex-testing, apex, apex-oas, metadata, sobjects-faux-generator**: various
- **utils-vscode**: internal use in preconditionCheckers, progressNotification, channelService, userService, etc.

---

## Orphaned Pieces (Not in utils)

### 1. LWC WorkspaceUtils

[workspaceUtils.ts](packages/salesforcedx-vscode-lwc/src/util/workspaceUtils.ts) - `getGlobalStore()` and `getWorkspaceSettings()` were only used by `previewService.ts` (deleted). The class is still initialized in [index.ts](packages/salesforcedx-vscode-lwc/src/index.ts) line 108 (`WorkspaceUtils.instance.init(extensionContext)`) but nothing calls the getters.

**Recommendation:** Remove `WorkspaceUtils` and its init call from LWC.

### 2. aura-language-server: nameFromFile / nameFromDirectory

Exported from [aura-language-server/src/index.ts](packages/salesforcedx-aura-language-server/src/index.ts). The only external consumer was `lightningLwcPreview.ts` (deleted). Used internally by `componentFromFile` and `componentFromDirectory` in the indexer.

**Recommendation:** Remove from public exports in aura-language-server. Keep implementation; they remain used internally.

---

## Dependency Notes

- LWC never had `@salesforce/salesforcedx-aura-language-server` as a direct dependency; the import may have resolved via workspace hoisting. LWC also had no direct `@salesforce/salesforcedx-utils` dependency; that was pulled in transitively.
- After removal, no dependency cleanup needed for utils or vscode-utils; LWC still uses them (e.g. stat, TimingUtils, readFile, getTestResultsFolder in test support).
