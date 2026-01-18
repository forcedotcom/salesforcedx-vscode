# Fix E2E Test Failures - Metadata Playwright Tests (Run #21106058975)

## Summary

**Workflow**: Metadata E2E (Playwright) - Run [#21106058975](https://github.com/forcedotcom/salesforcedx-vscode/actions/runs/21106058975)

**Branch**: `sm/e2e-non-tracking`

**Date**: 2026-01-18

| Platform | Status | Test Results |

|----------|--------|--------------|

| Web (Linux) | ✅ PASSED | All tests passed |

| macOS Desktop | ❌ FAILED | 1 test failed (viewChangesCommands) |

| Windows Desktop | ❌ FAILED | 4 tests failed |

## Failed Tests Summary

### macOS Desktop Failures (e2e-desktop macos-latest job)

| Test | Retries | Final Result |

|------|---------|--------------|

| viewChangesCommands.headless.spec.ts | 3 attempts, all failed | ❌ FAILED |

| deployOnSave.headless.spec.ts | 2 attempts (passed on retry1) | ✅ FLAKY |

| deleteSource.headless.spec.ts | 2 attempts (passed on retry1) | ✅ FLAKY |

### Windows Desktop Failures (e2e-desktop windows-latest job)

| Test | Retries | Final Result |

|------|---------|--------------|

| deleteSource.headless.spec.ts | 3 attempts, all failed | ❌ FAILED |

| deployOnSave.headless.spec.ts | 3 attempts, all failed | ❌ FAILED |

| deployManifest.headless.spec.ts | 3 attempts, all failed | ❌ FAILED |

---

## Root Cause Analysis

### Issue 1: viewChangesCommands - macOS (HARD FAILURE)

**Test**: `viewChangesCommands.headless.spec.ts`

**Evidence** (from error-context.md retry2):

- Output channel shows "Remote Changes (7):"
- Status bar shows: `7↓ 0↑` (7 remote changes, 0 local)
- Test is looking for "Local Changes" section but output only shows "Remote Changes"

**Screenshot**: [.e2e-artifacts/sm-e2e-non-tracking/21106058975/playwright-test-results-desktop-macos-latest/viewChangesCommands.headle-bc32a--correct-sections-in-output-desktop-electron-retry2/test-failed-1.png]

The screenshot shows:

- Salesforce Metadata output channel selected
- Only "Remote Changes (7):" visible in output
- No "Local Changes" section visible

**Root Cause**: The test runs `View All Changes` command which should display both "Local Changes" and "Remote Changes" sections. The output only shows "Remote Changes (7):". This suggests:

1. The output is truncated/scrolled and "Local Changes" might be above the visible area
2. The command might not be outputting the "Local Changes" section properly
3. There's a race condition where the output channel content doesn't include all sections

**Relevant Code** (viewChangesCommands.headless.spec.ts:55-75):

```typescript
const titleAllChanges = nls.localize('source_tracking_title_all_changes');
await waitForOutputChannelText(page, { expectedText: titleAllChanges });
// ...
const hasRemote = await outputChannelContains(page, sectionRemote);
const hasLocal = await outputChannelContains(page, sectionLocal);
expect(hasLocal, `View All Changes should show "${sectionLocal}" section`).toBe(true);
```

**Fix Approach**:

1. Check if `outputChannelContains` properly searches the full output (not just visible area)
2. The virtualized DOM issue - output panel might not have all content visible
3. May need to scroll output or use different approach to verify content

---

### Issue 2: Windows Desktop Tests - Windows Search Popup Interference

**Affected Tests**: deleteSource, deployOnSave, deployManifest (all Windows failures)

**Evidence from Screenshots**:

1. **deleteSource - Windows** [.e2e-artifacts/sm-e2e-non-tracking/21106058975/playwright-test-results-desktop-windows-latest/deleteSource.headless-Dele-116b7-and-org-via-command-palette-desktop-electron-retry2/test-failed-1.png]:

   - Windows Search popup visible at top: "Search vscode-orgbrowser-test-BuKZXF"
   - Class file visible: `DeleteSourceTest1768711619206.cls`
   - Output shows: "Apex class created successfully"
   - Status bar shows: `0↓ 1↑` (0 remote, 1 local)

2. **deployOnSave - Windows** [.e2e-artifacts/sm-e2e-non-tracking/21106058975/playwright-test-results-desktop-windows-latest/deployOnSave.headless-Depl-fca93--deploys-when-file-is-saved-desktop-electron-retry2/test-failed-1.png]:

   - Output channel shows "Tasks" (not "Salesforce Metadata")
   - Status bar shows: `0↓ 0↑`
   - No file open in editor
   - **Key observation**: Output channel is on wrong channel ("Tasks")

3. **deployManifest - Windows** [.e2e-artifacts/sm-e2e-non-tracking/21106058975/playwright-test-results-desktop-windows-latest/deployManifest.headless-De-a5a2a-eploys-via-all-entry-points-desktop-electron-retry2/test-failed-1.png]:

   - Windows Search popup visible at top: "Search vscode-orgbrowser-test-3ZAsAO"
   - Class file visible: `DeployManifestTest1768711765871.cls`
   - Error alert: "Error: Generate manifest failed:"
   - Status bar shows: `0↓ 1↑`

**Root Cause Analysis**:

1. **Windows Search Popup**: Tests fail with Windows Search popup ("Search vscode-orgbrowser-test-...") appearing. This happens when:

   - VS Code loses focus and Windows captures the F1 keypress
   - Command palette action accidentally triggers Windows Search

2. **Wrong Output Channel**: deployOnSave failure shows "Tasks" channel selected instead of "Salesforce Metadata"

   - This suggests `selectOutputChannel` is not working reliably on Windows

3. **Generate Manifest Error**: deployManifest shows "Error: Generate manifest failed:" 

   - The manifest generation command fails on Windows

**Important Observation**: Tests that don't require command palette interactions (like initial setup) succeed. The failures occur when executing commands via `executeCommandWithCommandPalette`.

---

### Issue 3: Flaky Tests on macOS

**Affected Tests**: deployOnSave, deleteSource (both passed on retry)

These tests failed on first attempt but passed on retry. This indicates timing/race condition issues rather than fundamental problems.

---

## Common Patterns

### Pattern 1: Windows Search Popup Interference (Windows only)

**Affected Tests**: All 3 Windows failures show Windows Search popup

**Screenshots**:

- deleteSource: Windows Search popup "Search vscode-orgbrowser-test-BuKZXF"
- deployManifest: Windows Search popup "Search vscode-orgbrowser-test-3ZAsAO"

**Hypothesis**: When VS Code loses focus momentarily, Windows captures keystrokes. F1 might trigger Windows Search if the VS Code window isn't properly focused.

**Fix Approaches**:

1. Use `page.bringToFront()` before command palette operations
2. Ensure VS Code has focus before F1 keypress
3. Add delay after focus operations
4. Consider using `workbench.action.openCommandPalette` directly via VS Code API

### Pattern 2: Output Channel Selection Issues (Windows)

**Affected Test**: deployOnSave shows "Tasks" channel instead of "Salesforce Metadata"

**Evidence**: Screenshot shows wrong output channel selected, suggesting `selectOutputChannel` failed silently or was interfered with.

**Fix Approaches**:

1. Verify output channel selection completed successfully
2. Add retry logic to `selectOutputChannel`
3. Check if channel exists before selection

### Pattern 3: Virtualized DOM - Output Channel Content (macOS)

**Affected Test**: viewChangesCommands - can't find "Local Changes" section

**Evidence**: Output only shows "Remote Changes (7):" in the visible area, but test expects "Local Changes" to be present.

**Root Cause**: VS Code's output panel uses virtualized rendering - only visible lines are in DOM. `outputChannelContains` may not find content that's scrolled out of view.

**Fix Approaches**:

1. Scroll to top of output before checking content
2. Use a different method to read all output channel content
3. Filter/search the output rather than checking DOM elements

---

## Artifacts for Review

### macOS Desktop Screenshots

| Test | Screenshot | Video |

|------|------------|-------|

| viewChangesCommands (retry2) | [test-failed-1.png](.e2e-artifacts/sm-e2e-non-tracking/21106058975/playwright-test-results-desktop-macos-latest/viewChangesCommands.headle-bc32a--correct-sections-in-output-desktop-electron-retry2/test-failed-1.png) | [videos/](.e2e-artifacts/sm-e2e-non-tracking/21106058975/playwright-test-results-desktop-macos-latest/videos/) |

| deleteSource (retry0 - failed) | [test-failed-1.png](.e2e-artifacts/sm-e2e-non-tracking/21106058975/playwright-test-results-desktop-macos-latest/deleteSource.headless-Dele-116b7-and-org-via-command-palette-desktop-electron/test-failed-1.png) | N/A |

| deployOnSave (retry0 - failed) | [test-failed-1.png](.e2e-artifacts/sm-e2e-non-tracking/21106058975/playwright-test-results-desktop-macos-latest/deployOnSave.headless-Depl-fca93--deploys-when-file-is-saved-desktop-electron/test-failed-1.png) | N/A |

### Windows Desktop Screenshots

| Test | Screenshot | Video |

|------|------------|-------|

| deleteSource (retry2) | [test-failed-1.png](.e2e-artifacts/sm-e2e-non-tracking/21106058975/playwright-test-results-desktop-windows-latest/deleteSource.headless-Dele-116b7-and-org-via-command-palette-desktop-electron-retry2/test-failed-1.png) | [videos/](.e2e-artifacts/sm-e2e-non-tracking/21106058975/playwright-test-results-desktop-windows-latest/videos/) |

| deployOnSave (retry2) | [test-failed-1.png](.e2e-artifacts/sm-e2e-non-tracking/21106058975/playwright-test-results-desktop-windows-latest/deployOnSave.headless-Depl-fca93--deploys-when-file-is-saved-desktop-electron-retry2/test-failed-1.png) | N/A |

| deployManifest (retry2) | [test-failed-1.png](.e2e-artifacts/sm-e2e-non-tracking/21106058975/playwright-test-results-desktop-windows-latest/deployManifest.headless-De-a5a2a-eploys-via-all-entry-points-desktop-electron-retry2/test-failed-1.png) | N/A |

### Trace Files (for Playwright Trace Viewer)

```bash
# viewChangesCommands macOS retry2
npx playwright show-trace .e2e-artifacts/sm-e2e-non-tracking/21106058975/playwright-test-results-desktop-macos-latest/viewChangesCommands.headle-bc32a--correct-sections-in-output-desktop-electron-retry2/trace.zip

# deleteSource Windows retry2
npx playwright show-trace .e2e-artifacts/sm-e2e-non-tracking/21106058975/playwright-test-results-desktop-windows-latest/deleteSource.headless-Dele-116b7-and-org-via-command-palette-desktop-electron-retry2/trace.zip

# deployOnSave Windows retry2
npx playwright show-trace .e2e-artifacts/sm-e2e-non-tracking/21106058975/playwright-test-results-desktop-windows-latest/deployOnSave.headless-Depl-fca93--deploys-when-file-is-saved-desktop-electron-retry2/trace.zip

# deployManifest Windows retry2
npx playwright show-trace .e2e-artifacts/sm-e2e-non-tracking/21106058975/playwright-test-results-desktop-windows-latest/deployManifest.headless-De-a5a2a-eploys-via-all-entry-points-desktop-electron-retry2/trace.zip
```

---

## Recommended Fix Order

### Priority 1: Fix viewChangesCommands (macOS Hard Failure)

**Problem**: Test can't find "Local Changes" section in output channel.

**Investigation Steps**:

1. Review trace file to see exact state when assertion fails
2. Check if `outputChannelContains` is using proper search strategy for virtualized DOM
3. Verify the "View All Changes" command outputs both sections

**Potential Fix**:

- Modify `outputChannelContains` to scroll output to top first
- Or use output channel filter/search to verify content existence
- Check if there's a way to get all output channel text regardless of scroll position

### Priority 2: Fix Windows Command Palette Issues

**Problem**: Windows Search popup interferes with F1 command palette.

**Investigation Steps**:

1. Review trace files to see exact moment Windows Search appears
2. Check if `page.bringToFront()` is called before F1
3. Compare with `apexGenerateClass` test which PASSED on Windows - what's different?

**Potential Fix**:

- Add `await page.bringToFront()` before `executeCommandWithCommandPalette`
- Add short delay after focus before keypress
- Use VS Code command API directly instead of simulating F1 keypress

### Priority 3: Address Flaky Tests (macOS)

**Problem**: deployOnSave and deleteSource failed once but passed on retry.

**Investigation Steps**:

1. Compare error-context.md from failed attempt vs passed attempt
2. Look for timing issues in setup or assertions

**Potential Fix**:

- Increase timeouts for specific operations
- Add more explicit waits for async operations to complete
- Review test steps for race conditions

---

## Environment Notes

- **Web (Linux)**: All tests PASSED - this is the baseline that works
- **macOS Desktop**: 1 hard failure (viewChangesCommands), 2 flaky passes
- **Windows Desktop**: 3 hard failures - all related to command palette/focus issues

The Web success and macOS flaky passes suggest:

1. Test logic is fundamentally sound
2. Desktop-specific issues are environment/focus related
3. Output channel virtualization is a macOS-specific challenge

---

## Action Items

- [ ] Investigate `outputChannelContains` behavior with virtualized DOM
- [ ] Review trace files for viewChangesCommands failure
- [ ] Add focus management before command palette operations
- [ ] Consider alternative to F1 for opening command palette on Windows
- [ ] Review and fix timing issues causing macOS flakiness