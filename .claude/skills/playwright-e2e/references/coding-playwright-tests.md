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
- `page.keyboard.type()` - edit content
- Monaco editor selectors - interact with editor

**Desktop-only tests** (`.headless.spec.ts` file naming or `createDesktopTest` fixture) may poll fs directly for durable success signals (e.g., `waitForEsrFile` checks on-disk artifacts) instead of flaky UI toast assertions.

## Web headless (`createHeadlessServer`)

- Virtual `folderPath` mount: Node `fs` does not see project files; use `folderUri` (`file://…`) or `.vscode/vscode-extension-test-disk-root.txt` (disk root) when services must resolve `SfProject` — see JSDoc on `packages/playwright-vscode-ext/src/web/createHeadlessServer.ts`
- Load extra extensions via `additionalExtensionDirs` (e.g. metadata for LWC create). **Web** `headlessServer` + **desktop** fixture: empty `lwc/` + CustomLabels + empty `snippetsE2E` (snippet specs); other bundles via **SFDX: Create Lightning Web Component**.
- LWC LSP ready (`waitForLwcLspReady` in `salesforcedx-vscode-lwc` `test/playwright/utils/lwcUtils.ts`): **web** — `LWC Extension` output line `LWC Language Server: indexing complete`; **desktop** — Editor Language Status / legacy status text `Indexing complete` (language status item often missing on web)

## Virtualized DOM

VS Code API (tree views, editors, output panels) only contains visible DOM lines (rest not present until scrolled into view).

- Don't rely on `scrollTo` - target element won't exist
- `scrollIntoViewIfNeeded` probably won't help

## Dialog Styles and macOS

Desktop fixture sets `window.menuStyle: "custom"` (context menus stay in DOM on macOS; use shared context-menu helpers) and `window.dialogStyle: "custom"` when spec needs to click modal dialog buttons (routes `showWarningMessage`, etc. through VS Code's DOM renderer for Playwright automation).

## Selectors and Assertions

- Prefer `aria` (getByRole) over css selectors
- `expect` assertions need clear error messages. Import `expect` from playwright
- Fail early, avoid fallbacks/retries
- Reusable locators belong in `locators.ts` - check before creating new ones

## Commands and Shortcuts

- Use `f1` for commands, not meta-shift-P
- Use `Control` for all. No ControlOrMeta

## Commands and i18n

Prefer `package.nls.json` for command titles instead of hardcoded strings.

- Protects tests when command labels change or are localized
- Pattern: `import packageNls from '../../../package.nls.json'` (adjust path for package root)
- Use for `executeCommandWithCommandPalette`, `executeExplorerContextMenuCommand`, `executeEditorContextMenuCommand`, `verifyCommandExists`, and `waitForOutputChannelText` expectedText (e.g. `Ended ${packageNls.deploy_this_source_text}`)
