# @salesforce/playwright-vscode-ext

Shared [Playwright](https://playwright.dev/) utilities, fixtures, and page objects for end-to-end testing of Salesforce DX VS Code extensions.

This package provides reusable building blocks for authoring Playwright tests against VS Code (both desktop and web/headless), including:

- VS Code launch fixtures for desktop and web/headless flavors
- Page objects for common VS Code UI surfaces (command palette, notifications, editors, sidebars)
- Helpers for managing scratch orgs and project workspaces in tests
- Utilities for working with VS Code APIs from Playwright

## Installation

```bash
npm install --save-dev @salesforce/playwright-vscode-ext @playwright/test
```

If you use the desktop fixtures (which create or reuse Salesforce scratch orgs), also install `@salesforce/core`:

```bash
npm install --save-dev @salesforce/core
```

`@salesforce/core` is declared as an optional peer dependency. Tests that only use the web/headless fixtures or the type-only exports do not need it.

## Usage

The package exports factories and helpers that compose with `@playwright/test`. For example, build a desktop test suite by combining the `createDesktopTest` factory with helpers and locators:

```typescript
import { expect } from '@playwright/test';
import { createDesktopTest, openCommandPalette, WORKBENCH } from '@salesforce/playwright-vscode-ext';

const test = createDesktopTest({
  extensionDirs: ['salesforcedx-vscode-core']
});

test('opens the command palette', async ({ vscodeApp }) => {
  await openCommandPalette(vscodeApp);
  await expect(vscodeApp.locator(WORKBENCH)).toBeVisible();
});
```

See the [package source](https://github.com/forcedotcom/salesforcedx-vscode/tree/develop/packages/playwright-vscode-ext) for the full set of exports, web/headless config factories (`createWebConfig`, `createHeadlessServer`), and example configurations.

> Note: the desktop test factory (`createDesktopTest`) currently assumes a monorepo layout where extension VSIX paths are resolved relative to a repo root containing `packages/`. It is primarily intended for use inside the `salesforcedx-vscode` monorepo; external consumers should use the web/headless and helper exports.

## Repository

This package is developed in the [salesforcedx-vscode](https://github.com/forcedotcom/salesforcedx-vscode) monorepo. File issues and feature requests at <https://github.com/forcedotcom/salesforcedx-vscode/issues>.

## License

[BSD 3-Clause License](./LICENSE.txt)
