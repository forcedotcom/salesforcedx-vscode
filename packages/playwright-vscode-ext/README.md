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

If you use the desktop fixtures or settings APIs (which work with Salesforce scratch orgs), you will need `@salesforce/core` types to resolve. Consumers using only web/headless fixtures or type-only exports do not need it; others should ensure `@salesforce/core` is installed in their project (as a dependency or dev dependency).

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

See the [package source](https://github.com/forcedotcom/salesforcedx-vscode/tree/develop/packages/playwright-vscode-ext) for the full set of exports: web/headless config factories (`createWebConfig`, `createHeadlessServer`), container fixtures (`createContainerConfig`, `createContainerTest` for Code Builder image testing), and example configurations.

> Note: the desktop test factory (`createDesktopTest`) resolves extension VSIX paths relative to a repo root containing `packages/`, so it is intended for use inside the `salesforcedx-vscode` monorepo. The container factories (`createContainerConfig`, `createContainerTest`) point a browser at a Code Builder `code-server` URL and expect the correct extensions to already be present in that container — extension installation happens in the CI workflow, not the fixture. External consumers should use the web/headless and helper exports.

## Repository

This package is developed in the [salesforcedx-vscode](https://github.com/forcedotcom/salesforcedx-vscode) monorepo. File issues and feature requests at <https://github.com/forcedotcom/salesforcedx-vscode/issues>.

## License

[BSD 3-Clause License](./LICENSE.txt)
