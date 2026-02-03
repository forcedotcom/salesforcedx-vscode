---
name: Fix File Operations and Context Menu Tests
overview: Update file operations tests to use actual file names and paths, enable context menu tests on web.
todos:
  - id: update-file-helpers
    content: Update createFileWithContents in packages/playwright-vscode-ext/src/utils/fileHelpers.ts to support saving files with actual names/paths
    status: pending
  - id: update-file-ops-tests
    content: Update all 4 tests in packages/playwright-vscode-ext/test/playwright/specs/fileOperations.headless.spec.ts to use actual file names and document paths in test steps
    status: pending
  - id: remove-context-menu-web-skips
    content: Remove test.skip(isVSCodeWeb(), ...) calls from both tests in packages/playwright-vscode-ext/test/playwright/specs/contextMenu.headless.spec.ts
    status: pending
  - id: test-context-menu-web
    content: Run context menu tests on web locally to identify and fix any web-specific issues
    status: pending
  - id: verify-all-tests-pass
    content: Verify all tests pass on web and desktop (except Mac desktop context menus which should skip)
    status: pending
---

# Fix File Operations and Context Menu Tests

## Overview

This plan addresses two main tasks:

1. Update file operations tests to use actual file names and paths (instead of 'unused' and untitled files)
2. Enable context menu tests on web (remove web skips and fix any web-specific issues)

## Tasks

### 1. File Operations - Use Actual File Names and Paths

**Current State**: Tests use `createFileWithContents(page, 'unused', content)` which creates untitled files to avoid filesystem dialogs.

**Required Change**: Tests must provide actual file names and path locations for created files.

**Files to Modify**:

- `packages/playwright-vscode-ext/test/playwright/specs/fileOperations.headless.spec.ts`
- Update all 4 tests to use actual file names (e.g., `test-file-1.txt`, `test-file-2.txt`)
- Specify file paths/locations in test steps
- Update `createFileWithContents` calls to use real file names
- May need to update `createFileWithContents` in `packages/playwright-vscode-ext/src/utils/fileHelpers.ts` to support saving files with names

**Considerations**:

- May need to handle save dialogs differently (use keyboard shortcuts or command palette to save)
- File paths should be relative to workspace root
- Tests should verify files appear in explorer with correct names/paths

### 2. Context Menu Tests - Enable Web Support

**Current State**: Tests skip web with `test.skip(isVSCodeWeb(), 'Context menu interaction differs in web environment')`

**Required Change**: Remove web skips and ensure tests work on web. According to `.cursor/rules/coding-playwright-tests.mdc` line 45: "Windows and Web are fine" for context menus.

**Files to Modify**:

- `packages/playwright-vscode-ext/test/playwright/specs/contextMenu.headless.spec.ts`
- Remove `test.skip(isVSCodeWeb(), ...)` calls from both tests
- Keep Mac desktop skip (`isMacDesktop()`) as that's documented limitation
- Test context menu functionality on web to identify any web-specific issues
- May need to adjust timing, locators, or interaction methods for web

**Investigation Needed**:

- Verify `.monaco-menu` locator works in web (currently in `packages/playwright-vscode-ext/src/utils/locators.ts`)
- Check if right-click behavior differs in web
- Ensure `selectContextMenuItem` in `packages/playwright-vscode-ext/src/pages/contextMenu.ts` works with web menus
- May need to adjust wait times or interaction methods for web

## Implementation Strategy

1. **File Operations**:

- Start by updating `createFileWithContents` to optionally save files with names
- Use command palette "File: Save As" or similar to save files with names
- Update tests to specify file names and verify they appear correctly
- Ensure tests work on both web and desktop

2. **Context Menu**:

- Remove web skips from tests
- Run tests locally on web to identify failures
- Debug and fix any web-specific issues (locators, timing, interactions)
- Ensure both editor and explorer context menu tests work on web

## Success Criteria

- All file operations tests use actual file names and paths
- File names and paths are clearly documented in test steps
- Context menu tests pass on web (remove web skips)
- Context menu tests still skip on Mac desktop (as documented)
- All tests pass on web and desktop (except Mac desktop context menus)
