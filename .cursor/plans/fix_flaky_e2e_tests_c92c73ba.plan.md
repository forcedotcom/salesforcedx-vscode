---
name: Fix Flaky E2E Tests
overview: Fix the `editOpenFile` function which is corrupting Apex class files in CI by not properly inserting newlines, causing deploy failures. The issue is that the DOM-based current-line detection and keyboard operations have timing issues in web/CI environments.
todos:
  - id: fix-editOpenFile
    content: Simplify editOpenFile to use End-of-line approach
    status: pending
  - id: test-local
    content: Run tests locally to verify fix
    status: pending
  - id: monitor-ci
    content: Monitor CI run after user pushes
    status: pending
  - id: analyze-results
    content: Analyze CI screenshots and update plan
    status: pending
---

# Fix Flaky E2E Tests

## Problem Analysis

From the CI screenshots, the `editOpenFile` function is corrupting files:**Expected file content:**

```apex
public class Test {
// comment
}
```

**Actual file content (from screenshot):**

```apex
public class Test {
// Editor context menu DeploySourcePathTest1767329215411}
```

The closing brace `}` is concatenated to the comment line. The Enter key press is not creating a newline properly, or there's a race condition between typing and the DOM update.

### Root Causes

1. **DOM-based current-line detection is unreliable**: The `.current-line` class may not update synchronously after keyboard navigation
2. **No wait between keyboard operations**: Typing and Enter happen without waiting for the editor to process
3. **Enter key may not work as expected**: In some cases, Enter at the end of a line may behave differently

## Solution

Rewrite `editOpenFile` to be more robust:

1. **Use End-of-line approach**: Instead of inserting at the start of a line, go to the end of line 1 and insert a new line below
2. **Add explicit waits**: Wait for the editor to stabilize after keyboard operations
3. **Verify the edit worked**: Check that the file content changed as expected before saving

## Iteration Process

Each iteration will:

1. Propose changes (no commit/push)
2. User reviews and pushes
3. Monitor CI results
4. Analyze screenshots/artifacts
5. Update plan with findings
6. Propose next changes

---

## Iteration 1: Fix editOpenFile

### Changes to [packages/playwright-vscode-ext/src/utils/fileHelpers.ts](packages/playwright-vscode-ext/src/utils/fileHelpers.ts)

Replace the current `editOpenFile` implementation with a simpler, more robust approach:

```typescript
export const editOpenFile = async (page: Page, comment: string): Promise<void> => {
  const editor = page.locator(EDITOR_WITH_URI).first();
  await editor.waitFor({ state: 'visible' });
  await editor.click();

  // Go to end of first line (class declaration)
  await page.keyboard.press('Control+Home');
  await page.keyboard.press('End');

  // Insert new line below and type comment
  await page.keyboard.press('Enter');
  await page.keyboard.type(`// ${comment}`);

  // Save file
  await executeCommandWithCommandPalette(page, 'File: Save');
  await expect(page.locator(DIRTY_EDITOR).first()).not.toBeVisible({ timeout: 5000 });
};
```

This approach:

- Goes to line 1, end of line
- Presses Enter to create a new line 2
- Types the comment on the new line 2
- Original closing brace stays on line 3

### Verification

Run locally first:

```bash
npm run test:web -w salesforcedx-vscode-metadata -- deployOnSave.headless.spec.ts
npm run test:web -w salesforcedx-vscode-metadata -- deployManifest.headless.spec.ts
```

---

## Artifacts Location

CI artifacts will be downloaded to: `/tmp/gh-artifacts-<run_id>/`

Structure:

- `playwright-test-results-web/` — Web (chromium) test results
- `playwright-test-results-desktop-windows-latest/` — Windows desktop test results

Each test folder contains:

- `test-failed-1.png` / `test-finished-1.png` — Screenshots
- `error-context.md` — Page snapshot at failure
- `trace.zip` — Playwright trace
- `video.webm` — Test recording

---

## Tracking

| Iteration | Changes | CI Run | Result | Next Steps |