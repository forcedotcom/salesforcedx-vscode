---
name: Fix Windows E2E Tests
overview: Make all Playwright E2E tests pass on Windows desktop. Web tests are now passing after fixing `editOpenFile`. Windows failures are caused by `executeCommandWithCommandPalette` failing to open the command palette, resulting in text being typed into the editor.
todos:
  - id: fix-windows-keyboard-input
    content: Fix keyboard operations in editOpenFile on Windows desktop
    status: pending
  - id: monitor-ci
    content: Monitor CI run after user pushes
    status: pending
  - id: analyze-results
    content: Analyze CI screenshots and update plan
    status: completed
---

# Fix Windows E2E Tests

## Goal

Make all Playwright E2E tests pass on Windows desktop.

## Current Status

| Platform | Status | Notes |

|----------|--------|-------|

| Web (chromium) | ✅ PASSED | `editOpenFile` fix working — **no longer a concern** |

| macOS desktop | ✅ PASSED | **no longer a concern** |

| Windows desktop | ❌ FAILED | Keyboard operations in `editOpenFile` not working — **only remaining issue** |

---

## Iteration 2 Results (CI Run 20660170620)

**Status:** ✅ Web tests passing, ❌ Windows desktop still failing

**Windows Desktop Failures:**

1. **`deployManifest` test**: Timeout in `createFileWithContents` (line 80)
   - "Folder path" textbox timeout — same issue as before

2. **`deployOnSave` test**: Timeout in `editOpenFile` (line 210)
   - `locator.click: Timeout 30000ms exceeded` when trying to save
   - File content shows no comment was added — keyboard operations (`Control+Home`, `End`, `Enter`, `type`) aren't working on Windows desktop
   - Root cause: Keyboard events aren't reaching the editor after clicking

**Key Finding:** The `editOpenFile` fix works for web and macOS, but on Windows desktop, clicking the editor and waiting for `.view-line` isn't sufficient — keyboard events don't reach the editor. Need Windows-specific approach or more robust focus mechanism.

---

## Iteration 1 Results (CI Run 20659201069)

### Screenshot Analysis

1. **`deployOnSave` failure** (`test-failed-1.png`):

   - File content shows: `File: Savepublic class DeployOnSaveTest...`
   - The text "File: Save" was **typed into the editor** instead of executing as a command
   - **Note**: Preview mode is irrelevant — files in preview mode can still be edited. The issue is that keyboard events aren't reaching the editor.
   - **Root cause**: `executeCommandWithCommandPalette` failed — F1 didn't open the command palette, so `keyboard.type("File: Save")` went to the editor

2. **`deploySourcePath` failure** (`test-failed-1.png`):

   - File content is correct: `public class...` with `// Editor context menu test` comment
   - `editOpenFile` worked correctly here
   - Failure: "Deploying progress notification should be visible"
   - **Root cause**: Likely a timing issue or deploy not triggered

3. **`deployManifest` failure** (`test-failed-1.png`):

   - Explorer shows `.sf` folder selected, no Apex class visible
   - Status bar: `94↓ 1↑` (1 local change exists)
   - Editor is empty (no file open)
   - **Root cause**: `createFileWithContents` failed — "Folder path" textbox timeout

### Key Finding: Command Palette Failure

The `deployOnSave` screenshot clearly shows:

- Line 1: `File: Savepublic class DeployOnSaveTest1767362417254 {`
- The command "File: Save" was typed as text, not executed

This means `openCommandPalette()` failed silently — the `F1` key didn't open the command palette, but the 3-second timeout passed without the `QUICK_INPUT_WIDGET` becoming visible, and execution continued.

**Current code** (`packages/playwright-vscode-ext/src/pages/commands.ts`):

```typescript
const openCommandPalette = async (page: Page): Promise<void> => {
  await page.keyboard.press('F1');
  await page.locator(QUICK_INPUT_WIDGET).waitFor({ state: 'visible', timeout: 3000 });
};
```

The `waitFor` throws if the widget doesn't appear, but the test continued — suggesting either:

1. The widget appeared briefly then closed
2. There's a race condition
3. F1 doesn't work reliably on Windows desktop

---

## Artifacts Location

CI artifacts downloaded to: `/tmp/gh-artifacts-<run_id>/`

- `playwright-test-results-web/` — Web (chromium) test results (✅ passing)
- `playwright-test-results-desktop-windows-latest/` — Windows desktop test results (❌ failing)

---

## Tracking

| Iteration | Changes | CI Run | Result | Next Steps |

|-----------|---------|--------|--------|------------|

| 1 | Simplify editOpenFile | 20659201069 | ✅ Web/macOS passed<br>❌ Windows failed | Fix keyboard operations on Windows |

| 2 | Wait for editor readiness | 20660170620 | ✅ Web/macOS passed<br>❌ Windows failed | Fix Windows desktop keyboard input |
