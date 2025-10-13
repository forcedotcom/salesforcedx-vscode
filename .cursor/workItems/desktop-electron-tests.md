# Desktop Electron Tests for Org Browser

## Status: ✅ Complete - Desktop Tests Working

## Overview

Successfully implemented Playwright-based desktop Electron tests for the Org Browser extension that share test logic with web tests using platform-specific setup fixtures. Tests now run on both web and desktop platforms with the same test files.

## What Was Implemented

### 1. Directory Structure ✅

Created new consolidated structure:

```
test/playwright/
├── specs/                     # Shared test specs (5 files)
├── fixtures/                  # Platform-specific fixtures (3 files)
├── pages/                     # Page objects - shared (4 files)
├── utils/                     # Test utilities - shared (2 files)
├── shared/                    # Shared utilities (1 file)
└── web/                       # Web-only infrastructure (1 file)
```

### 2. Platform-Specific Fixtures ✅

**Created Files:**

- `test/playwright/fixtures/desktopFixtures.ts` - Electron launcher with worker-scoped VS Code download
- `test/playwright/fixtures/webFixtures.ts` - Web fixture wrapper
- `test/playwright/fixtures/desktopWorkspace.ts` - Temporary workspace creation for desktop tests

**Key Features:**

- VS Code downloads **once per worker** (cached in `~/.vscode-test/`)
- Each test gets **fresh Electron instance** with isolated workspace
- Worker-scoped fixtures for performance optimization

### 3. Configuration Files ✅

**Created:**

- `playwright.config.desktop.ts` - Desktop Electron test configuration

**Updated:**

- `playwright.config.web.ts` - Updated testDir to `./test/playwright/specs`, webServer command path
- `tsconfig.json` - Added playwright configs to includes

### 4. NPM Scripts ✅

Added to package.json:

```bash
test:desktop
test:desktop:debug
test:desktop:ci
test:e2e  # Runs both web:headless and desktop
```

Note: No separate headless script for desktop since Electron apps always show UI (no true headless mode).

### 5. File Reorganization ✅

**Moved:**

- `test/web/headless/*.spec.ts` → `test/playwright/specs/` (5 spec files)
- `test/web/pages/*` → `test/playwright/pages/` (4 page objects)
- `test/web/utils/*` → `test/playwright/utils/` (2 utilities)
- `test/web/shared/*` → `test/playwright/shared/` (1 utility)
- `test/web/headless-server.ts` → `test/playwright/web/headlessServer.ts`

**Renamed:**

- `headless-helpers.ts` → `helpers.ts` (updated imports in 3 files)

### 6. Code Updates ✅

- Added `navigate` parameter to `waitForVSCodeWorkbench()` for desktop compatibility
- Fixed all linting errors (no-restricted-imports, explicit-function-return-type, no-unused-vars)
- Added eslint-disable comments for Node.js test infrastructure files
- Updated all import paths to reference new locations

### 7. Documentation ✅

Updated README.md with:

- Quick test commands for web and desktop
- Environment setup instructions (DREAMHOUSE_ORG_ALIAS)
- New test structure diagram
- Key design principles

## How to Use

### Local Development

```bash
# Set org alias (reuse existing org)
export DREAMHOUSE_ORG_ALIAS=myTestOrg

# Verify org exists
sf org display -o myTestOrg

# Run web tests (headless)
npm run test:web:headless -w salesforcedx-vscode-org-browser

# Run desktop tests (UI always visible)
npm run test:desktop -w salesforcedx-vscode-org-browser

# Run both
npm run test:e2e -w salesforcedx-vscode-org-browser
```

### CI Integration (Future)

Update `.github/workflows/orgBrowserE2E.yml` to add desktop matrix:

- ubuntu-latest
- macos-latest
- windows-latest

## Key Design Decisions

1. **Shared Test Logic**: Same test files run on both platforms via Playwright fixtures
2. **Auth via Env**: Uses `DREAMHOUSE_ORG_ALIAS` (existing e2e pattern)
3. **Worker-Scoped Downloads**: VS Code downloads once per worker, cached across tests
4. **Test-Scoped Instances**: Each test gets fresh Electron with isolated workspace
5. **Platform Detection**: Fixtures handle platform differences transparently via `VSCODE_DESKTOP` env var
6. **Bundled Extension Testing**: Desktop tests use `/dist` bundled extension (production-like), not `/out` compiled code

## Current Status

### ✅ Completed

**Infrastructure:**

- Compilation: `npm run compile` passes
- Linting: `npm run lint` passes (only pre-existing warning)
- File structure: All files in correct locations
- Import paths: All updated and correct
- TypeScript: All types valid
- Desktop infrastructure: Fixtures, configs, unified test imports working
- VS Code launches successfully on desktop
- Extension loads and activity bar appears
- Workspace trust modal disabled
- Both extensions (org-browser + services) loading correctly

**Web Tests (5/5 passing):**

- orgBrowser.load.smoke.spec.ts ✓
- orgBrowser.describe.scratch.spec.ts ✓
- orgBrowser.customTab.headless.spec.ts ✓
- orgBrowser.customObject.headless.spec.ts ✓
- orgBrowser.folderedReport.headless.spec.ts ✓

**Desktop Tests (5/5 passing):**

- orgBrowser.load.smoke.spec.ts ✓
- orgBrowser.describe.scratch.spec.ts ✓
- orgBrowser.customTab.headless.spec.ts ✓
- orgBrowser.customObject.headless.spec.ts ✓
- orgBrowser.folderedReport.headless.spec.ts ✓

**Auth Resolution:**

- ✅ Fixed SF CLI auth discovery using `Global.SF_STATE_FOLDER` and `target-org` in `.sf/config.json`
- ✅ Desktop tests use real SF CLI auth files from `~/.sf/` (no mocking needed)
- ✅ Added console error logging in `connectionService.ts` for better debugging

**Platform-Specific Adaptations:**

- ✅ Network interception (`page.waitForResponse()`) doesn't work in Electron - conditionally skipped for desktop
- ✅ Navigation (`page.goto()`) not applicable for Electron - conditionally skipped for desktop
- ✅ Settings: Web uses VS Code settings for auth fields, desktop uses SF CLI auth files
- ✅ Aria snapshots: Platform-specific snapshots stored in `test/playwright/specs/<spec-name>-snapshots/desktop-electron/`
- ✅ Type-to-search: Uses loading state check (`codicon-tree-item-loading` → `codicon-tree-item-expanded`) to ensure tree is ready
- ✅ Tree focus: Clicks parent folder's content area (not twistie) once before type-to-search to ensure focus without toggling expansion

**Key Learnings:**

- Electron apps always show UI (no true headless mode like Chromium) - `--headed` flag doesn't affect Electron
- Virtualized tree lists require careful handling - avoid clicking random sidebar elements that could trigger async expansions
- Type-to-search requires: (1) tree expanded and loaded, (2) tree has focus, (3) wait between click and type for event processing
- Platform detection via `VSCODE_DESKTOP=1` env var enables same test files for both platforms

## Next Steps

1. ✅ Test locally with actual scratch org - **DONE**, all tests passing

2. Add CI workflow job for desktop tests (cross-platform matrix):
   - ubuntu-latest
   - macos-latest
   - windows-latest

3. Monitor for any platform-specific issues:
   - Windows path separators (use `path.join()` - already implemented)
   - macOS .app bundle handling
   - Linux display server requirements
   - Verify aria snapshots are consistent across OS platforms

## Files Created/Modified

**Created:**

- test/playwright/fixtures/desktopFixtures.ts (~117 lines) - Electron launcher with console monitoring
- test/playwright/fixtures/index.ts (~5 lines) - Unified fixture exports with platform detection
- test/playwright/fixtures/desktopWorkspace.ts (~40 lines) - Workspace creation with SF CLI config
- playwright.config.desktop.ts (~33 lines) - Desktop test configuration (sequential execution)
- Platform-specific aria snapshots in `test/playwright/specs/<spec-name>-snapshots/desktop-electron/`

**Modified:**

- test/playwright/fixtures/webFixtures.ts - Deleted (unnecessary wrapper)
- test/playwright/pages/orgBrowserPage.ts - Added platform-specific logic for navigation, network interception, tree focus
- test/playwright/pages/settings.ts - Added platform-specific auth setup (skip settings for desktop)
- test/playwright/utils/helpers.ts - Added platform-specific navigation in `waitForVSCodeWorkbench`
- test/playwright/web/headlessServer.ts - Fixed path calculation for new structure
- playwright.config.web.ts - Renamed from playwright.config.ts, updated testDir and webServer paths
- playwright.config.desktop.ts - Set `workers: 1` and `fullyParallel: false` for sequential execution
- package.json - Added 4 new scripts (test:desktop, test:desktop:debug, test:desktop:ci, updated test:e2e)
- README.md - Updated testing documentation with desktop instructions
- tsconfig.json - Added desktop config to includes
- packages/salesforcedx-vscode-services/src/core/connectionService.ts - Added error logging for AuthInfo failures
- 3 spec files - Removed unused browser param, updated imports

## Files Moved

- 5 spec files
- 4 page objects
- 2 utilities
- 1 shared utility
- 1 web infrastructure file

Total: 16 files moved to new structure
