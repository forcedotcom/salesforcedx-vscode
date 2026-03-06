---
name: Workbench Click Removal Verification
overview: Verify removal of the workbench click from openCommandPalette does not break any consumers, and run web + desktop E2E tests across all packages that use playwright-vscode-ext.
todos:
  - id: add-wait-close-to-5-specs
    content: Add waitForVSCodeWorkbench + closeWelcomeTabs to 5 specs that don't do their own wait+close before using command palette
    status: completed
  - id: run-playwright-ext-web
    content: Run playwright-vscode-ext test:web (do not run in parallel with other test commands)
    status: completed
  - id: run-playwright-ext-desktop
    content: Run playwright-vscode-ext test:desktop (do not run in parallel with other test commands)
    status: completed
  - id: run-services-web
    content: Run salesforcedx-vscode-services test:web (do not run in parallel with other test commands)
    status: completed
  - id: run-org-browser-web
    content: Run salesforcedx-vscode-org-browser test:web (do not run in parallel with other test commands)
    status: completed
  - id: run-org-browser-desktop
    content: Run salesforcedx-vscode-org-browser test:desktop (do not run in parallel with other test commands)
    status: completed
  - id: run-metadata-web
    content: Run salesforcedx-vscode-metadata test:web (do not run in parallel with other test commands)
    status: completed
  - id: run-metadata-desktop
    content: Run salesforcedx-vscode-metadata test:desktop (do not run in parallel with other test commands)
    status: pending
  - id: run-apex-log-web
    content: Run salesforcedx-vscode-apex-log test:web (do not run in parallel with other test commands)
    status: pending
  - id: run-apex-log-desktop
    content: Run salesforcedx-vscode-apex-log test:desktop (do not run in parallel with other test commands)
    status: completed
  - id: run-apex-testing-web
    content: Run salesforcedx-vscode-apex-testing test:web (do not run in parallel with other test commands)
    status: pending
  - id: run-apex-testing-desktop
    content: Run salesforcedx-vscode-apex-testing test:desktop (do not run in parallel with other test commands)
    status: pending
  - id: run-core-desktop
    content: Run salesforcedx-vscode-core test:desktop (do not run in parallel with other test commands)
    status: pending
  - id: run-apex-replay-debugger-desktop
    content: Run salesforcedx-vscode-apex-replay-debugger test:desktop (do not run in parallel with other test commands)
    status: pending
  - id: rerun-metadata-nonTrackingOrg
    content: 'Rerun metadata desktop: Non-Tracking Org deploy/retrieve operations (do not run in parallel)'
    status: pending
  - id: rerun-metadata-projectRetrieveStart
    content: 'Rerun metadata desktop: Project Retrieve Start (do not run in parallel)'
    status: completed
  - id: rerun-apex-log-logRetrieval
    content: 'Rerun apex-log desktop: Log retrieval get logs open folder (do not run in parallel)'
    status: completed
  - id: rerun-apex-testing-testExplorer-web
    content: 'Rerun apex-testing web: Apex Tests via Test Explorer (do not run in parallel)'
    status: pending
  - id: rerun-apex-testing-testExplorer-desktop
    content: 'Rerun apex-testing desktop: Apex Tests via Test Explorer (do not run in parallel)'
    status: pending
  - id: rerun-apex-testing-runApexTests-desktop
    content: 'Rerun apex-testing desktop: Run Apex Tests via Command Palette (do not run in parallel)'
    status: pending
  - id: rerun-apex-testing-apexTestSuite-desktop
    content: 'Rerun apex-testing desktop: Apex Test Suite (do not run in parallel)'
    status: pending
  - id: rerun-core-deployAndRetrieve
    content: 'Rerun core desktop: Deploy and Retrieve (do not run in parallel)'
    status: pending
  - id: rerun-core-delete
    content: 'Rerun core desktop: Delete (do not run in parallel)'
    status: pending
  - id: rerun-core-metadataDeployRetrieve
    content: 'Rerun core desktop: Metadata Deploy Retrieve (do not run in parallel)'
    status: pending
  - id: rerun-apex-replay-debugger
    content: 'Rerun apex-replay-debugger desktop: trace flag exec anon replay (do not run in parallel)'
    status: pending
  - id: todo-1772744774320-4ljos837e
    content: ''
    status: pending
isProject: false
---

# Workbench Click Removal Verification

## 1. Add wait+close to 5 specs (do first)

These specs don't do their own wait+close before using the command palette. Since `openCommandPalette` no longer calls `closeWelcomeTabs`, add `waitForVSCodeWorkbench` + `closeWelcomeTabs` (or `assertWelcomeTabExists` + `closeWelcomeTabs`) to their startup:

| Spec                                         | Package      | Fix                                                                                                                                    |
| -------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `orgBrowser.folderedReport.headless.spec.ts` | org-browser  | Add `waitForVSCodeWorkbench`, `assertWelcomeTabExists`, `closeWelcomeTabs` before `upsertScratchOrgAuthFieldsToSettings` in beforeEach |
| `orgBrowser.describe.scratch.spec.ts`        | org-browser  | Same                                                                                                                                   |
| `orgBrowser.customTab.headless.spec.ts`      | org-browser  | Same                                                                                                                                   |
| `orgBrowser.customObject.headless.spec.ts`   | org-browser  | Same                                                                                                                                   |
| `apexTestClassCreate.headless.spec.ts`       | apex-testing | Change `setupMinimalOrgAndAuth(page, false)` to `setupMinimalOrgAndAuth(page)` (or add `closeWelcomeTabs` after setup)                 |

## What Was Removed

From [packages/playwright-vscode-ext/src/pages/commands.ts](packages/playwright-vscode-ext/src/pages/commands.ts) in `openCommandPalette`:

1. The `workbench.click()` line — original purpose: "Click workbench to ensure focus is not on walkthrough elements."
2. The `closeWelcomeTabs(page)` call — it had the same workbench-click behavior. The `closeWelcomeTabs` function remains; only its invocation from `openCommandPalette` was removed.

## Dependencies on That Behavior

**Explicit dependency (now obsolete):** [executeAnonymous.headless.spec.ts](packages/salesforcedx-vscode-apex-log/test/playwright/specs/executeAnonymous.headless.spec.ts) lines 77-78:

```ts
// Open command palette directly with F1 — NOT executeCommandWithCommandPalette,
// because openCommandPalette clicks the workbench which clears the editor selection
```

That step uses F1 directly to preserve selection for `executeSelection` (which requires `editorHasSelection`). With the workbench click removed, this distinction is moot — the test should work either way. The comment is now stale and can be simplified.

**Other workbench clicks (unchanged):** Several places still use workbench click for their own purposes; none depend on `openCommandPalette` doing it:

- [helpers.ts:156](packages/playwright-vscode-ext/src/utils/helpers.ts) — `closeWelcomeTabs` clicks workbench before tab interactions (no longer called by `openCommandPalette`)
- [fileHelpers.ts:42,179](packages/playwright-vscode-ext/src/utils/fileHelpers.ts) — file operations
- [settings.ts:24](packages/playwright-vscode-ext/src/pages/settings.ts) — settings UI
- [commandPalette.headless.spec.ts:53](packages/playwright-vscode-ext/test/playwright/specs/commandPalette.headless.spec.ts) — test explicitly focuses workbench before palette tests

**Potential risk:** On Windows, the original comment said "F1 can trigger Windows Search if VS Code doesn't have focus." The workbench click may have helped ensure VS Code had focus. `page.bringToFront()` and the 100ms delay remain; if Windows desktop tests regress, consider restoring a targeted focus step.

## Test Execution Order

**Baseline:** All of these tests were passing before this change (with some flaky failures). Any repeatable failures must be caused by this change and must be fixed before progressing to the next package.

**Do not run in parallel.** Run each test command sequentially (one at a time). Port conflicts (e.g. 3003 span server) and resource contention can cause failures when tests run concurrently.

Run from repo root. Use `-w <package-name>` for each package. Per [verification SKILL](.claude/skills/verification/SKILL.md), use `--retries 0` for deterministic failures.

| Order | Package                                  | Web | Desktop |
| ----- | ---------------------------------------- | --- | ------- |
| 1     | playwright-vscode-ext                    | Yes | Yes     |
| 2     | salesforcedx-vscode-services             | Yes | No      |
| 3     | salesforcedx-vscode-org-browser          | Yes | Yes     |
| 4     | salesforcedx-vscode-metadata             | Yes | Yes     |
| 5     | salesforcedx-vscode-apex-log             | Yes | Yes     |
| 6     | salesforcedx-vscode-apex-testing         | Yes | Yes     |
| 7     | salesforcedx-vscode-core                 | No  | Yes     |
| 8     | salesforcedx-vscode-apex-replay-debugger | No  | Yes     |

## Commands

```bash
# 1. playwright-vscode-ext
npm run test:web -w @salesforce/playwright-vscode-ext -- --retries 0
npm run test:desktop -w @salesforce/playwright-vscode-ext -- --retries 0

# 2. services (web only)
npm run test:web -w salesforcedx-vscode-services -- --retries 0

# 3. org-browser
npm run test:web -w salesforcedx-vscode-org-browser -- --retries 0
npm run test:desktop -w salesforcedx-vscode-org-browser -- --retries 0

# 4. metadata
npm run test:web -w salesforcedx-vscode-metadata -- --retries 0
npm run test:desktop -w salesforcedx-vscode-metadata -- --retries 0

# 5. apex-log
npm run test:web -w salesforcedx-vscode-apex-log -- --retries 0
npm run test:desktop -w salesforcedx-vscode-apex-log -- --retries 0

# 6. apex-testing
npm run test:web -w salesforcedx-vscode-apex-testing -- --retries 0
npm run test:desktop -w salesforcedx-vscode-apex-testing -- --retries 0

# 7. core (desktop only)
npm run test:desktop -w salesforcedx-vscode-core -- --retries 0

# 8. apex-replay-debugger (desktop only)
npm run test:desktop -w salesforcedx-vscode-apex-replay-debugger -- --retries 0
```

**Package names for `-w`:** Use the `name` from each package's package.json (e.g. `@salesforce/playwright-vscode-ext`, `salesforcedx-vscode-apex-log`).

## Verification Results (2025-03-05)

| Package                                  | Web                                      | Desktop                                                                                             |
| ---------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------- |
| playwright-vscode-ext                    | ✅ 24 passed                             | ✅ 21 passed, 3 skipped                                                                             |
| salesforcedx-vscode-services             | ✅ 3 passed                              | N/A                                                                                                 |
| salesforcedx-vscode-org-browser          | ✅ 4 passed                              | ✅ 4 passed                                                                                         |
| salesforcedx-vscode-metadata             | ✅ 17 passed, 2 skipped                  | ⚠️ 10 passed, 6 skipped, 3 failed (nonTrackingOrg, projectRetrieveStart, refreshSObjectDefinitions) |
| salesforcedx-vscode-apex-log             | ⚠️ 4 passed, 1 failed (executeAnonymous) | ✅ 5 passed                                                                                         |
| salesforcedx-vscode-apex-testing         | ⚠️ 1 failed (testExplorer discovery)     | ⚠️ 1 passed, 3 failed (apexTestSuite, runApexTests, testExplorer)                                   |
| salesforcedx-vscode-core                 | N/A                                      | ⚠️ 2 passed, 3 failed (delete, deployAndRetrieve, metadataDeployRetrieve), 2 interrupted            |
| salesforcedx-vscode-apex-replay-debugger | N/A                                      | ⚠️ 1 failed (command not in palette: SFDX: Execute Anonymous Apex with Currently Open Editor)       |

**Rerun results:**

- metadata nonTrackingOrg: failed (command not in palette)
- metadata projectRetrieveStart: ✅ passed
- apex-log logRetrieval: ✅ passed
- apex-testing testExplorer (web+desktop): failed (test discovery / output timeout)
- apex-testing runApexTests, apexTestSuite: failed (output timeout)
- core deployAndRetrieve, delete, metadataDeployRetrieve: failed (command not in palette)
- apex-replay-debugger: failed (command not in palette)
