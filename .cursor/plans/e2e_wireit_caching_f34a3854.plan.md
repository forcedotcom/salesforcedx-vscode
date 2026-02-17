---
name: E2E Wireit Caching
overview: 'Add proper `files` and `output: []` configurations to test:web and test:desktop scripts in org-browser, metadata, apex-testing, and playwright-vscode-ext packages to enable wireit caching.'
todos:
  - id: org-browser
    content: Update test:web and test:desktop in salesforcedx-vscode-org-browser/package.json
    status: completed
  - id: metadata
    content: Update test:web and test:desktop in salesforcedx-vscode-metadata/package.json
    status: completed
  - id: apex-testing
    content: Update test:web and test:desktop in salesforcedx-vscode-apex-testing/package.json
    status: completed
  - id: playwright-ext
    content: Update test:web and test:desktop in playwright-vscode-ext/package.json
    status: completed
  - id: verify
    content: Run WIREIT_CACHE=none npm run test:web twice to verify caching works
    status: completed
isProject: false
---

# E2E Wireit Caching Configuration

## Current State

The `test:web` and `test:desktop` scripts have incomplete `files` arrays - they only list the playwright config file, missing the actual test files and local test infrastructure.

## Key Insight

With `output: []`, wireit caches based solely on input files. If none of the tracked files change, the test is skipped. The dependencies (like `vscode:bundle`) already track the extension source code changes.

## Files to Track

For each package, `test:web` and `test:desktop` need:

1. **Playwright config** (already present): `playwright.config.web.ts` / `playwright.config.desktop.ts`
2. **Local test files**: `test/playwright/**/*.ts` (specs, fixtures, pages, utils, web server)
3. **Package.json**: Could affect test behavior via config
4. **Note**: `dist/` changes are tracked via `vscode:bundle` dependency - no need to list

## Changes by Package

### [packages/salesforcedx-vscode-org-browser/package.json](packages/salesforcedx-vscode-org-browser/package.json)

Current `test:web.files`: `["playwright.config.web.ts"]`
Current `test:desktop.files`: `["playwright.config.desktop.ts"]`

Add to both:

- `test/playwright/**/*.ts`
- `package.json`
- `output: []`

### [packages/salesforcedx-vscode-metadata/package.json](packages/salesforcedx-vscode-metadata/package.json)

Same pattern as org-browser.

### [packages/salesforcedx-vscode-apex-testing/package.json](packages/salesforcedx-vscode-apex-testing/package.json)

`test:web` already has `test/playwright/**/*.ts`.
Add `package.json` and `output: []`.
`test:desktop` needs the same additions.

### [packages/playwright-vscode-ext/package.json](packages/playwright-vscode-ext/package.json)

`test:web` already has `src/**/*.ts`, `test/playwright/**/*.ts`, `playwright.config.web.ts`.
`test:desktop` has `test/playwright/**/*.ts`, `playwright.config.desktop.ts`.
Add `package.json` and `output: []` to both.

## Final Configuration Pattern

```json
"test:web": {
  "command": "playwright test --config=playwright.config.web.ts",
  "dependencies": [/* existing */],
  "files": [
    "playwright.config.web.ts",
    "test/playwright/**/*.ts",
    "package*.json"
  ],
  "output": []
}
```

```json
"test:desktop": {
  "command": "playwright test --config=playwright.config.desktop.ts",
  "env": { "VSCODE_DESKTOP": "1" },
  "dependencies": [/* existing */],
  "files": [
    "playwright.config.desktop.ts",
    "test/playwright/**/*.ts",
    "package*.json"
  ],
  "output": []
}
```

## What Triggers Re-run

- Changes to test specs, fixtures, pages, utils, web server (`test/playwright/**/*.ts`)
- Changes to playwright config
- Changes to package.json or package.nls.json (could affect extension behavior/i18n)
- Changes to dist/web or dist/ via `vscode:bundle` dependency
- Changes to playwright-vscode-ext via `../playwright-vscode-ext:compile` dependency
