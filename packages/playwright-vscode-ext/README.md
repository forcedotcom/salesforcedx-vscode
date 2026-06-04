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

```typescript
import { test, expect } from '@salesforce/playwright-vscode-ext';

test('opens the command palette', async ({ vscodePage }) => {
  await vscodePage.commandPalette.run('Developer: Reload Window');
  await expect(vscodePage.workbench.title).toBeVisible();
});
```

See the [package source](https://github.com/forcedotcom/salesforcedx-vscode/tree/develop/packages/playwright-vscode-ext) for the full set of exports and example configurations.

## Repository

This package is developed in the [salesforcedx-vscode](https://github.com/forcedotcom/salesforcedx-vscode) monorepo. File issues and feature requests at <https://github.com/forcedotcom/salesforcedx-vscode/issues>.

## License

[BSD 3-Clause License](./LICENSE.txt)
