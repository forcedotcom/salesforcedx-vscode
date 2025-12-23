---
name: retrieveOnLoad E2E Tests
overview: Set up e2e testing infrastructure for salesforcedx-vscode-services extension and create tests for retrieveOnLoad functionality using standard metadata available in all orgs (CustomObject:Activity, Workflow:Case).
todos:
  - id: minimal-org-setup
    content: Add createMinimalOrg function to playwright-vscode-ext
    status: completed
  - id: playwright-configs
    content: Create playwright.config.desktop.ts and playwright.config.web.ts
    status: completed
  - id: test-fixtures
    content: Create test fixtures in test/playwright/fixtures/
    status: completed
  - id: package-json-updates
    content: Add devDeps and scripts to package.json with wireit
    status: completed
  - id: desktop-test-spec
    content: Create retrieveOnLoad.headless.spec.ts desktop test
    status: completed
  - id: helper-page
    content: Create servicesChannelPage helper for output verification
    status: completed
  - id: run-validation
    content: Run compile, lint, test, bundle, knip validation
    status: completed
---

# E2E Tests for retrieveOnLoad in Services Extension

## Add minimal scratch org setup function

Create new function `createMinimalOrg()` in [`packages/playwright-vscode-ext/src/utils/dreamhouseScratchOrgSetup.ts`](packages/playwright-vscode-ext/src/utils/dreamhouseScratchOrgSetup.ts):

- Reuse existing org check pattern (look for alias first)
- Create scratch org without Dreamhouse deploy
- Use alias `minimalTestOrg` to distinguish from Dreamhouse orgs
- Export from [`packages/playwright-vscode-ext/src/index.ts`](packages/playwright-vscode-ext/src/index.ts)

## Add e2e infrastructure to services package

### Create Playwright configs

- [`packages/salesforcedx-vscode-services/playwright.config.desktop.ts`](packages/salesforcedx-vscode-services/playwright.config.desktop.ts) - use `createDesktopConfig()`
- [`packages/salesforcedx-vscode-services/playwright.config.web.ts`](packages/salesforcedx-vscode-services/playwright.config.web.ts) - use `createWebConfig()`

### Create test fixtures

- [`packages/salesforcedx-vscode-services/test/playwright/fixtures/desktopFixtures.ts`](packages/salesforcedx-vscode-services/test/playwright/fixtures/desktopFixtures.ts) - export `test` using `createDesktopTest()`
- [`packages/salesforcedx-vscode-services/test/playwright/fixtures/index.ts`](packages/salesforcedx-vscode-services/test/playwright/fixtures/index.ts) - re-export fixtures

### Update package.json

Add to [`packages/salesforcedx-vscode-services/package.json`](packages/salesforcedx-vscode-services/package.json):

- `devDependencies`: `@salesforce/playwright-vscode-ext: "*"`
- `scripts`:
- `test:desktop`: wireit script similar to org-browser
- `test:web`: wireit script similar to org-browser  
- `test:e2e`: wireit script that runs both
- `wireit` config for the new scripts

## Create e2e test specs

### Desktop test

[`packages/salesforcedx-vscode-services/test/playwright/specs/retrieveOnLoad.headless.spec.ts`](packages/salesforcedx-vscode-services/test/playwright/specs/retrieveOnLoad.headless.spec.ts):

- Use `createMinimalOrg()` instead of `create()`
- Set `retrieveOnLoad` setting to `"CustomObject:Activity, Workflow:Case"`
- Verify output channel messages show retrieval in progress
- Wait for files to open in editor (2 files expected)
- Verify editor tabs contain expected filenames
- Check output channel for success message with file count
- Console/network error monitoring

### Web test (optional future enhancement)

Basic structure for web tests using headless server approach from metadata package

## Helper utilities

Create [`packages/salesforcedx-vscode-services/test/playwright/pages/servicesChannelPage.ts`](packages/salesforcedx-vscode-services/test/playwright/pages/servicesChannelPage.ts):

- Methods to open and read from Salesforce Services output channel