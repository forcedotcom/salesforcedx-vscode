---
name: ESLint rule for playwright locators
overview: Create a dynamic ESLint rule that reads `packages/playwright-vscode-ext/src/utils/locators.ts` at lint time to detect duplicated selector strings in playwright test files and the playwright package, enforcing use of the exported constants instead. The rule automatically picks up new locators without requiring rule updates.
todos:
  - id: create-rule-file
    content: Create `packages/eslint-local-rules/src/noDuplicatePlaywrightLocators.ts` with rule logic to detect string/template literals matching locator selectors
    status: pending
  - id: register-rule
    content: Register the rule in `packages/eslint-local-rules/src/index.ts`
    status: pending
    dependencies:
      - create-rule-file
  - id: configure-eslint
    content: Add rule to playwright-specific config block in `eslint.config.mjs` (files matching 'packages/**/test/playwright/**/*.ts' and 'packages/playwright-vscode-ext/**/*.ts')
    status: pending
    dependencies:
      - register-rule
  - id: create-tests
    content: Create test file `packages/eslint-local-rules/test/no-duplicate-playwright-locators.test.ts` with valid/invalid test cases
    status: pending
    dependencies:
      - create-rule-file
---

# ESLint Rule to Prevent Duplication of Playwright Locators

## Overview

Create a custom ESLint rule `no-duplicate-playwright-locators` that detects string literals and template literals matching selector values from `packages/playwright-vscode-ext/src/utils/locators.ts` and enforces use of the exported constants instead.

## Implementation Steps

### 1. Create the ESLint Rule (`packages/eslint-local-rules/src/noDuplicatePlaywrightLocators.ts`)

The rule will **dynamically read and parse** `packages/playwright-vscode-ext/src/utils/locators.ts` at lint time (similar to `noDuplicateI18nValues` reading `i18n.ts`):

- **Find locators.ts file**: Walk up from the file being linted to find the repo root (look for root `package.json` or `.git` directory), then resolve to `packages/playwright-vscode-ext/src/utils/locators.ts`. Cache the resolved path per workspace to avoid repeated lookups.
- **Parse with TypeScript parser**: Use `@typescript-eslint/parser` to parse the locators file (like `noDuplicateI18nValues` does)
- **Extract exported constants**: Traverse the AST to find all `export const` declarations:
- Extract constant name (e.g., `WORKBENCH`, `EDITOR`)
- Extract string literal values (e.g., `'.monaco-workbench'`, `'.monaco-editor'`)
- Handle template literals (e.g., `` `${EDITOR}[data-uri]` `` - resolve to final string value)
- Handle array constants (e.g., `SETTINGS_SEARCH_INPUT`) - extract all array elements
- **Cache results**: Store parsed locators in a Map keyed by file path (like `commandMustBeInPackageJson` caches package.json)
- **Detect violations**:
- String literals: `'.monaco-editor'` → matches `EDITOR`
- Template literals: `` `.monaco-workbench .tabs-container .tab` `` → matches `TAB` (exact) or contains `WORKBENCH`
- Partial matches: `.monaco-workbench .tabs-container .tab` contains both `WORKBENCH` and `TAB` - prefer exact match (`TAB`)
- **Match patterns in**:
- `page.locator('...')` calls
- `page.getByRole()` with selector arguments
- Any string/template literal that matches selector values
- **Provide error messages**: Suggest the appropriate constant name (e.g., "Use `EDITOR` from '@salesforcedx/vscode-playwright/utils/locators' instead")
- **Auto-fix support**: Mark rule as `fixable: 'code'` and implement fixes that:
- Replace string literals with constant names: `'.monaco-editor'` → `EDITOR`
- Replace template literals: `` `.monaco-workbench .tabs-container .tab` `` → `TAB` (if exact match) or `` `${WORKBENCH} .tabs-container .tab` `` (if partial)
- Add import statement if constant is not already imported:
    - Check existing imports from `@salesforcedx/vscode-playwright` or relative paths to `playwright-vscode-ext`
    - If import exists, add constant to existing import specifiers
    - If no import exists, insert new import statement after the last import (or at top if no imports)
- Handle import path resolution: Determine correct import path based on file location (relative vs package import)

### 2. Register the Rule (`packages/eslint-local-rules/src/index.ts`)

Add the new rule to the exports:

```typescript
import { noDuplicatePlaywrightLocators } from './noDuplicatePlaywrightLocators';
// ... in plugin rules:
'no-duplicate-playwright-locators': noDuplicatePlaywrightLocators,
```



### 3. Configure ESLint (`eslint.config.mjs`)

Add the rule to the playwright-specific configuration block (lines 451-493):

```javascript
{
  files: [
    'packages/**/test/playwright/**/*.ts',
    'packages/playwright-vscode-ext/**/*.ts'
  ],
  rules: {
    'local/no-duplicate-playwright-locators': 'error',
    // ... existing rules
  }
}
```



### 4. Create Tests (`packages/eslint-local-rules/test/no-duplicate-playwright-locators.test.ts`)

Test cases should include:

- **Valid cases**:
- Using constants from locators (`page.locator(EDITOR)`)
- Template literals that don't match selectors
- Constants already imported and used correctly
- **Invalid cases** (should report errors):
- String literals matching selectors (`page.locator('.monaco-editor')`)
- Template literals containing selector strings
- Partial matches (e.g., `.monaco-workbench .tabs-container .tab` should use `TAB`)
- **Auto-fix test cases**:
- Fix replaces string literal with constant: `page.locator('.monaco-editor')` → `page.locator(EDITOR)`
- Fix adds import when none exists
- Fix adds constant to existing import specifiers
- Fix handles relative import paths correctly
- Fix handles package import paths correctly
- Fix replaces template literal with constant (exact match)
- Fix replaces template literal parts (partial match with `${WORKBENCH}`)
- Fix skips when import path cannot be determined
- Fix skips when constant name conflicts with existing identifier

### 5. Handle Edge Cases

- Template literals with expressions: Check if the static parts match selectors
- Array selectors (`SETTINGS_SEARCH_INPUT`): Check each array element
- Combined selectors: Detect when multiple constants should be used (e.g., `${WORKBENCH} .custom-class`)
- Already imported: Don't flag if the constant is already imported/used in scope

## Technical Details

- **Dynamic file reading**: Use `fs.readFileSync()` to read `locators.ts` (like `noDuplicateI18nValues`)
- **TypeScript parsing**: Use `@typescript-eslint/parser` to parse the locators file AST
- **AST traversal**: Extract `export const` declarations and resolve their values:
- Handle string literals directly
- Resolve template literals with string concatenation (e.g., `` `${EDITOR}[data-uri]` ``)
- Handle array constants by extracting all string elements
- **Caching**: Cache parsed locators per workspace root to avoid re-parsing
- **Matching logic**:
- Exact matches: `'.monaco-editor'` → `EDITOR`
- Substring matches: `.monaco-workbench .custom` → contains `WORKBENCH`
- Prefer exact matches over substring matches when both match
- **Import detection**: Check if constants are already imported from locators to avoid false positives
- **Auto-fix implementation**:
- Use `fixer.replaceText()` to replace string literals with constant names
- Use `fixer.replaceTextRange()` for template literals (replace entire template or parts)
- Import management:
    - Traverse AST to find all `ImportDeclaration` nodes
    - Check if import from locators exists (check both package name and relative paths)
    - If import exists: use `fixer.insertTextAfter()` to add constant to import specifiers
    - If no import: find last import statement or top of file, use `fixer.insertTextAfter()` or `fixer.insertTextBefore()`
    - Import path resolution:
    - Files in `playwright-vscode-ext`: use relative path `'../utils/locators'` or `'./utils/locators'`
    - Files in other packages: use package import `'@salesforcedx/vscode-playwright/utils/locators'`
    - Calculate relative path from current file to `packages/playwright-vscode-ext/src/utils/locators.ts`
- Fix limitations:
    - Only fix exact matches (not partial matches in template literals with expressions)
    - Skip fixes if import path cannot be determined
    - Skip fixes if constant name conflicts with existing identifier in scope

## Files to Modify