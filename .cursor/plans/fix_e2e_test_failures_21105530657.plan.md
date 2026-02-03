# Fix E2E Test Failures - Metadata Playwright Tests (Run #21105530657)

## Summary

**Workflow**: Metadata E2E (Playwright) - Run [#21105530657](https://github.com/forcedotcom/salesforcedx-vscode/actions/runs/21105530657)

**Branch**: `sm/e2e-non-tracking`

**Date**: 2026-01-18

| Platform | Status | Failures |

|----------|--------|----------|

| Web (Linux) | FAILED | 3 tests (deployOnSave flaky + 2 blocked) |

| macOS Desktop | PASSED | 0 |

| Windows Desktop | FAILED | 3 tests |

## Failed Tests Summary

### Web/Linux Failures (e2e-web job)

1. **viewChangesCommands.headless.spec.ts** - View Changes Commands (BLOCKED)
2. **sourceTrackingStatusBar.headless.spec.ts** - Source Tracking Status Bar (BLOCKED)  
3. **deployOnSave.headless.spec.ts** - Deploy On Save (FLAKY - passed after retry?)

### Windows Desktop Failures (e2e-desktop windows-latest job)

1. **deleteSource.headless.spec.ts** - Delete from Project and Org
2. **deployManifest.headless.spec.ts** - Deploy Manifest
3. **deployOnSave.headless.spec.ts** - Deploy On Save

---

## Root Cause Analysis

### Issue 1: Web Tests Blocked (Extension Activation)

**Affected Tests**: viewChangesCommands, sourceTrackingStatusBar (web only)

**Evidence** (from error-context.md and screenshots):

**Screenshots**:

- `test-results-web/viewChangesCommands.headle-bc32a.../test-failed-1.png`
- `test-results-web/sourceTrackingStatusBar.he-92eb7.../test-failed-1.png`

Both screenshots show:

- VS Code stuck on Settings screen (setting `salesforcedx-vscode-code-builder-web.instanceUrl`)
- No source tracking status bar visible
- Extension activation error notification in bottom right

**Analysis**: Tests are blocked during setup. See `coding-playwright-tests.mdc` for known extension activation issues in web environment.

---

### Issue 2: Deploy On Save - Web (Timing/Flakiness)

**Test**: `deployOnSave.headless.spec.ts`

**Evidence**: The test ran 3 times (chromium, chromium-retry1, chromium-retry2), all with error-context.md files.

**Screenshot**: `test-results-web/deployOnSave.headless-Depl-fca93.../test-failed-1.png`

Shows:

- Class created: `DeployOnSaveTest1768708548039.cls`
- Output shows: "Deploy on save complete: 2 succeeded"
- Status bar shows: `4↓ 0↑` (4 remote changes, 0 local)

**Analysis**: The deploy appears to have completed successfully! Output shows "Deploy on save complete: 2 succeeded". The test failure may be:

1. Timing issue waiting for the "Deploy on save triggered" message
2. Message appearing before the test waits for it
3. Output channel race condition

---

### Issue 3: Delete Source - Windows

**Test**: `deleteSource.headless.spec.ts`

**Screenshot**: `test-results-desktop-windows-latest/deleteSource.headless-Dele-116b7.../test-failed-1.png`

**Evidence**:

- Shows Windows search popup open at top: "Search vscode-orgbrowser-test-LC1M4b"
- Class file visible: `DeleteSourceTest1768708785324.cls`
- Output shows: "Apex class created successfully"
- Status bar shows: `0↓ 1↑` (0 remote, 1 local change)

**Analysis**: The Windows Search popup is interfering with the test. This happens when:

1. A command palette action triggers Windows Search instead of VS Code's command palette
2. Focus leaves VS Code window briefly
3. The test is stuck because it can't interact with the search popup

**Fix**: Need to ensure command palette is properly dismissed/closed before proceeding, or handle the Windows Search popup scenario.

---

### Issue 4: Deploy Manifest - Windows

**Test**: `deployManifest.headless.spec.ts`

**Screenshot**: `test-results-desktop-windows-latest/deployManifest.headless-De-a5a2a.../test-failed-1.png`

**Error** (from error-context.md):

```
alert: "Error: Generate manifest failed:"
```

**Evidence**:

- Windows Search popup is also visible at top
- Class file visible: `DeployManifestTest1768708964740.cls`
- Test failed in "generate manifest from apex class" step

**Analysis**: The manifest generation command fails on Windows. The Windows Search popup interference suggests the same issue as deleteSource - the command palette interaction is triggering Windows Search instead of executing the VS Code command.

---

### Issue 5: Deploy On Save - Windows

**Test**: `deployOnSave.headless.spec.ts`

**Screenshot**: `test-results-desktop-windows-latest/deployOnSave.headless-Depl-fca93.../test-failed-1.png`

**Error** (from error-context.md):

```
alert: "Error: Deploy on save failed:"
```

**Evidence**:

- Windows Search popup visible at top (same pattern)
- Class file visible: `DeployOnSaveTest1768709089253.cls`
- Output shows extension activation, but no deploy triggered
- Status bar shows: `0↓ 1↑`

**Analysis**: The deploy-on-save fails. The Windows Search popup is blocking test interaction. The deploy may not have triggered because:

1. File save didn't complete due to interference
2. Deploy-on-save service didn't catch the save event
3. Command execution was captured by Windows Search instead

---

## Common Patterns

### Pattern 1: Windows Search Popup Interference

**Affected Tests**: All 3 Windows failures show Windows Search popup visible in screenshots

**Observation**:

- Windows Search popup appears ("Search vscode-orgbrowser-test-...") when tests fail
- `executeCommandWithCommandPalette` uses F1 to open command palette (see `packages/playwright-vscode-ext/src/pages/commands.ts:28`)
- Tests fail at command execution steps
- **Important**: `apexGenerateClass` test also uses F1 (`executeCommandWithCommandPalette`) and **PASSED** on Windows, so F1 itself isn't broken

**Hypothesis**: Windows Search popup may be a symptom rather than root cause. The popup might appear after test failure, or only in specific scenarios. Root cause needs investigation via trace files.

**Fix Approaches** (to investigate):

1. Ensure VS Code window is focused before command palette
2. Use `page.bringToFront()` before command execution  
3. Review trace files to see exact sequence of events
4. Check if Windows Search is capturing F1 keypress

### Pattern 2: Web Extension Activation Issues

**Affected Tests**: viewChangesCommands, sourceTrackingStatusBar (web)

**Note**: See `coding-playwright-tests.mdc` for documented extension activation issues in web environment.

---

## Artifacts for Review

### Web/Linux Screenshots

| Test | Screenshot | Video |

|------|------------|-------|

| viewChangesCommands | [test-failed-1.png](.e2e-artifacts/sm-e2e-non-tracking/21105530657/playwright-test-results-web/viewChangesCommands.headle-bc32a--correct-sections-in-output-chromium/test-failed-1.png) | [video.webm](.e2e-artifacts/sm-e2e-non-tracking/21105530657/playwright-test-results-web/viewChangesCommands.headle-bc32a--correct-sections-in-output-chromium/video.webm) |

| sourceTrackingStatusBar | [test-failed-1.png](.e2e-artifacts/sm-e2e-non-tracking/21105530657/playwright-test-results-web/sourceTrackingStatusBar.he-92eb7-s-through-full-deploy-cycle-chromium/test-failed-1.png) | [video.webm](.e2e-artifacts/sm-e2e-non-tracking/21105530657/playwright-test-results-web/sourceTrackingStatusBar.he-92eb7-s-through-full-deploy-cycle-chromium/video.webm) |

| deployOnSave | [test-failed-1.png](.e2e-artifacts/sm-e2e-non-tracking/21105530657/playwright-test-results-web/deployOnSave.headless-Depl-fca93--deploys-when-file-is-saved-chromium-retry2/test-failed-1.png) | [video.webm](.e2e-artifacts/sm-e2e-non-tracking/21105530657/playwright-test-results-web/deployOnSave.headless-Depl-fca93--deploys-when-file-is-saved-chromium-retry2/video.webm) |

### Windows Desktop Screenshots

| Test | Screenshot | Video |

|------|------------|-------|

| deleteSource | [test-failed-1.png](.e2e-artifacts/sm-e2e-non-tracking/21105530657/playwright-test-results-desktop-windows-latest/deleteSource.headless-Dele-116b7-and-org-via-command-palette-desktop-electron/test-failed-1.png) | [videos/*.webm](.e2e-artifacts/sm-e2e-non-tracking/21105530657/playwright-test-results-desktop-windows-latest/videos/) |

| deployManifest | [test-failed-1.png](.e2e-artifacts/sm-e2e-non-tracking/21105530657/playwright-test-results-desktop-windows-latest/deployManifest.headless-De-a5a2a-eploys-via-all-entry-points-desktop-electron/test-failed-1.png) | [videos/*.webm](.e2e-artifacts/sm-e2e-non-tracking/21105530657/playwright-test-results-desktop-windows-latest/videos/) |

| deployOnSave | [test-failed-1.png](.e2e-artifacts/sm-e2e-non-tracking/21105530657/playwright-test-results-desktop-windows-latest/deployOnSave.headless-Depl-fca93--deploys-when-file-is-saved-desktop-electron/test-failed-1.png) | [videos/*.webm](.e2e-artifacts/sm-e2e-non-tracking/21105530657/playwright-test-results-desktop-windows-latest/videos/) |

### Trace Files (for Playwright Trace Viewer)

Each test folder contains a `trace.zip` that can be viewed with:

```bash
npx playwright show-trace .e2e-artifacts/sm-e2e-non-tracking/21105530657/playwright-test-results-desktop-windows-latest/deleteSource.headless-Dele-116b7-and-org-via-command-palette-desktop-electron/trace.zip
```

---

## Recommended Fix Order

### Priority 1: Windows Failures Investigation

1. **Review trace files to understand root cause**

   - Since `apexGenerateClass` uses F1 and passed, F1 itself isn't broken
   - Windows Search popup may be symptom, not cause
   - Use trace files to see exact sequence: `npx playwright show-trace <trace.zip>`

2. **Compare passing vs failing tests**

   - What's different between `apexGenerateClass` (passed) and `deleteSource`/`deployManifest`/`deployOnSave` (failed)?
   - Check timing, test state, or specific operations that differ

### Priority 2: Web Extension Activation Error

1. **Investigate why tests are stuck**

   - Tests fail with TS extension activation error present (see `coding-playwright-tests.mdc` for documented issues)
   - Tests appear stuck at settings screen
   - Need to determine if error notification is blocking, or if test is failing for another reason
   - Review trace files to see exact failure point

### Priority 3: Deploy On Save Timing

1. **Review `waitForOutputChannelText` timing**

   - The web test shows deploy completed but test failed
   - May need to wait for the message earlier or with different approach

---

## Environment Notes

- **macOS Desktop**: All tests PASSED - this is the baseline that works
- **Web (Linux)**: Extension activation issues specific to web environment
- **Windows Desktop**: Focus/Search popup issues specific to Windows

The macOS success suggests the test logic itself is sound - the issues are platform-specific environment handling.