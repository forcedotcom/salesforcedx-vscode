---
description: Writing Playwright tests (*.spec.ts)
---

# Coding Playwright Tests

## Reuse

Check playwright ext for reuse before creating utilities/PageObjects

## Structure

One test per file. Many steps allowed.

## Waiting and Timing

- Never `waitForTimeout` - wait for specific page elements
- `page.waitForSelector()` - elements appear
- `expect(locator).toBeVisible()` - visibility
- `page.waitForLoadState()` - page state changes
- Don't use `page.waitForResponse()` - doesn't work in desktop/electron
- Don't use `networkidle` - not available on desktop/electron
- Use `test.step` to organize sequential tests

## Workspace API Version

Default `sourceApiVersion` in test fixtures is 64.0. Bump per-spec if deploying ESR metadata or features requiring higher API:

```ts
import { setWorkspaceApiVersion } from '…/utils/oasHelpers';
// In test setup:
await setWorkspaceApiVersion(workspaceDir, '66.0');
```

## File System and VS Code API

**NEVER use Node.js fs/path or VS Code API** unless test is desktop-only (`.headless.spec.ts` or desktop fixture only)

**For cross-platform (web + desktop) tests, use UI interactions:**

- Quick Open: `@salesforce/playwright-vscode-ext` `openFileByName` — palette "Go to File…" (web + desktop); VS Code 1.116+ rows often `basename` + segments + trailing `file results` — match logic `packages/playwright-vscode-ext/src/utils/fileHelpers.ts`
- `Control+Home`, `Control+s` - navigate and save
- `page.keyboard.type()` - edit content; call `disableMonacoAutoClosing(page)` first to prevent auto-bracket/quote duplication (vs clipboard + parallel races)
- Monaco editor selectors - interact with editor

**Desktop-only tests** (`.headless.spec.ts` file naming or `createDesktopTest` fixture) may poll fs directly for durable success signals (e.g., `waitForEsrFile` checks on-disk artifacts) instead of flaky UI toast assertions.

**Desktop diagnostic tests (inspecting telemetry):** When testing telemetry output, create custom fixtures with `additionalExtensionDirs: ['salesforcedx-vscode-core']` + `userSettings: { 'telemetry.telemetryLevel': 'all', '…localTelemetryLogging': 'true' }` + real scratch org. Polls on-disk telemetry artifacts (O11y spans + AppInsights-shaped events) for integration testing. Example: `packages/salesforcedx-vscode-lightning/test/playwright/fixtures/telemetryFixtures.ts`.

## Web headless (`createHeadlessServer`)

- Virtual `folderPath` mount: Node `fs` does not see project files; use `folderUri` (`file://…`) or `.vscode/vscode-extension-test-disk-root.txt` (disk root) when services must resolve `SfProject` — see JSDoc on `packages/playwright-vscode-ext/src/web/createHeadlessServer.ts`
- Load extra extensions via `additionalExtensionDirs` (e.g. metadata for LWC create). **Web** `headlessServer`: metadata + apex-log only (no core/apex, desktop only). **Desktop** fixture: metadata + apex-log + apex + core (core required for apex-testing UI features).
- LWC LSP ready (`waitForLwcLspReady` in `salesforcedx-vscode-lwc` `test/playwright/utils/lwcUtils.ts`): **web** — `LWC Extension` output line `LWC Language Server: indexing complete`; **desktop** — Editor Language Status / legacy status text `Indexing complete` (language status item often missing on web)

## Virtualized DOM

VS Code API (tree views, editors, output panels) only contains visible DOM lines (rest not present until scrolled into view).

- Don't rely on `scrollTo` - target element won't exist
- `scrollIntoViewIfNeeded` probably won't help
- **Tree item count:** Use `aria-setsize` (VS Code's tree model count) instead of `.count()` (DOM nodes). Reads full child count regardless of viewport. Pattern: `getByRole('treeitem', { level: 1 }).first().getAttribute('aria-setsize')`. See `OrgBrowserPage` helpers: `getRootTypeCount()`, `waitForRootTypeCount(expected)`, `getStableRootTypeCount()` (tolerates scroll/unmount race)

## Modal Dialog Buttons

Desktop fixture sets `window.menuStyle: "custom"` (context menus stay in DOM on macOS; use shared context-menu helpers) and `window.dialogStyle: "custom"` when spec needs to click modal dialog buttons (routes `showWarningMessage`, etc. through VS Code's DOM renderer for Playwright automation).

**Dismiss async modals deterministically:** a `confirmOrThrow`/`showWarningMessage` modal that renders only after a network round-trip (e.g. the org-display sensitive-info prompt appears after an org SOQL query) must be dismissed with `clickModalDialogButton(page, buttonLabel, timeoutMs)`, NOT a blind `page.keyboard.press('Escape')`. Escape races the render: if it lands before the modal appears, the modal opens afterward and lingers, blocking the next command palette. `clickModalDialogButton` waits for the modal, then clicks. (Escape is still fine for dismissing quick-input pickers — those are already open when you press it.)

```typescript
// Good: waits for the async modal, then dismisses it
await selectOrgInPicker(page, alias);
await clickModalDialogButton(page, 'Cancel', 30_000);

// Bad: Escape races the modal render — the modal may open after and linger
await selectOrgInPicker(page, alias);
await page.keyboard.press('Escape');
```

## Selectors and Assertions

- Prefer `aria` (getByRole) over css selectors
- `expect` assertions need clear error messages. Import `expect` from playwright
- Fail early, avoid fallbacks/retries
- Reusable locators belong in `locators.ts` - check before creating new ones

## Hover Tooltips on Windows

Clicking a tree item (e.g. a Test Explorer node) raises a Monaco hover widget (`.hover-contents`, e.g. `lwc1 (Not yet run)`). On Windows it lingers and **intercepts pointer events** on adjacent rows/buttons, so the next `.click()` times out with `subtree intercepts pointer events`. `keyboard.press('Escape')` does not reliably dismiss it.

Fix — force the clicks and retry the whole select → reveal → act sequence (the sanctioned exception to "avoid retries"):

```typescript
await testCase.scrollIntoViewIfNeeded();
await expect(async () => {
  await testCase.click({ force: true });
  await testCase.hover({ force: true });
  const runButton = testCase.getByRole('button', { name: /^Run Test/ });
  await runButton.waitFor({ state: 'visible', timeout: 3000 });
  await runButton.click({ force: true });
}).toPass({ timeout: 30_000 });
```

Reference: `salesforcedx-vscode-lwc` `lwcRunTests.desktop.spec.ts` / `lwcDebugTests.desktop.spec.ts`.

## Commands and Shortcuts

- Use `f1` for commands, not meta-shift-P
- Use `Control` for all. No ControlOrMeta

## Native VS Code Commands

Native VS Code commands (`File: Save`, `View: Close All Editors`, `Select All`, `Paste`, `Go to Definition`, etc.) — use named wrappers in `packages/playwright-vscode-ext/src/pages/nativeCommands.ts` (exported from `src/index.ts`), NOT `executeCommandWithCommandPalette(page, '<literal>')`.

- `saveFile(page)`, `closeAllEditors(page)`, `selectAll(page)`, `goToDefinition(page, sel?, opts?)`, etc. — grep `nativeCommands.ts` for full list before adding a literal.
- Wrappers return same Promise → existing `.catch(() => {})` chains + palette/selection opts still work.
- Reserve `executeCommandWithCommandPalette` for extension/test-provider commands (`SFDX:`, `Testing:`, `Test:`) — NOT native.
- Native command with no wrapper yet? Add one to `nativeCommands.ts`, don't inline the literal.

## Commands and i18n

Prefer `package.nls.json` for command titles instead of hardcoded strings.

- Protects tests when command labels change or are localized
- Pattern: `import packageNls from '../../../package.nls.json'` (adjust path for package root)
- Use for `executeCommandWithCommandPalette`, `executeExplorerContextMenuCommand`, `executeEditorContextMenuCommand`, `verifyCommandExists`, and `waitForOutputChannelText` expectedText (e.g. `Ended ${packageNls.deploy_this_source_text}`)

## Commands with Editor Selection

Selection-guarded commands (e.g., debug/execute from selection) require editor focus + selection. Preserve both with `preserveSelection: true`:

```typescript
// Setup selection first (ensure editor has focus)
await page.keyboard.press('Control+a');

// Open palette — preserve selection
await executeCommandWithCommandPalette(page, commandTitle, undefined, {
  preserveSelection: true
});
```

Without it: palette open blurs editor, clears selection, hides selection-guarded commands.

## Clicking Code Lenses

Use `clickCodeLens(page, text, opts?)` for code lens actions.

- Signature: `clickCodeLens(page, text, opts?: { timeout?: number })`
- **Apex callers** — pass longer timeout (e.g. `{ timeout: 180_000 }`) to account for Apex Language Server indexing
- Helper returns on first lens with visible text matching (whitespace-tolerant exact match)
- Limitation: can't disambiguate multiple lenses with identical labels in same file — caller must scope the search (e.g. navigate to specific line first)

## Output Panel and Debug Sessions

Debug sessions that open extension-specific output channels can hang or behave unexpectedly if a non-debug output panel is already visible. Before launching debug sessions, close the panel with `hidePanel(page)`.

```typescript
// Before debug session startup
await hidePanel(page);
await clickCodeLens(page, 'Debug'); // or run debug command
```

Use `ensureOutputPanelOpen(page)` to prepare output during setup; close before each debug trigger to prevent interference.

## Notifications and Toast Messages

Click notification action buttons IMMEDIATELY after the toast appears — palette/maximize ops hide toasts before deferred clicks.

- `waitForNotification(page, pattern, opts?)` — wait for notification matching regex; returns locator
- `acceptNotification(page, pattern, buttonName, opts?)` — wait for notification + click button (one-liner for immediate action)
- **Timing critical**: Command Palette open/close and maximized output panels hide toasts. Deferred capture/click fails.
- **Pattern**: Click notification action FIRST. Verify other UI state (output channel content) in a separate `test.step` AFTER.

Example:

```typescript
// Step 1: Run command, capture & click notification immediately
await acceptNotification(page, /pattern/, 'Action Name', { timeout: 60_000 });

// Step 2: Separate step to verify output channel after action completed
await test.step('verify output channel', async () => {
  await selectOutputChannel(page, 'Output Channel Name');
  await waitForOutputChannelText(page, /expected text/);
});
```

Bad pattern (fails):

```typescript
// DON'T: palette/maximize between wait and click — toast disappears
const notif = await waitForNotification(page, /pattern/);
await executeCommandWithCommandPalette(page, CMD_TOGGLE_PANEL);
const button = notif.getByRole('button', { name: 'Action Name' });
await button.click(); // locator stale — button already hidden
```
