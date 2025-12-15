---
name: i18n package.json lint rule
overview: Add an ESLint rule to enforce that user-facing strings in package.json contributes sections use i18n placeholders (%key%) and that those keys exist in the sibling package.nls.json file.
todos:
  - id: add-eslint-json-dep
    content: Add @eslint/json to root devDependencies
    status: pending
  - id: create-rule
    content: Create packageJsonI18nDescriptions.ts rule in eslint-local-rules
    status: pending
  - id: export-rule
    content: Export new rule from eslint-local-rules/src/index.ts
    status: pending
  - id: configure-eslint
    content: Configure eslint.config.mjs for JSON linting with the new rule
    status: pending
  - id: add-tests
    content: Add test file for the new rule
    status: pending
  - id: fix-violations
    content: Fix existing hardcoded strings in package.json files
    status: pending
---

# Lint Rule for i18n in package.json

## Approach

Use `@eslint/json` (official ESLint JSON plugin using Momoa AST) to lint `packages/*/package.json` files. The rule will:

1. Check specific paths in `contributes` for `%key%` pattern
2. Verify keys exist in sibling `package.nls.json`

## Implementation

### 1. Add dependency

Add `@eslint/json` to root [`package.json`](package.json) devDependencies.

### 2. Create the rule

Create [`packages/eslint-local-rules/src/packageJsonI18nDescriptions.ts`](packages/eslint-local-rules/src/packageJsonI18nDescriptions.ts):

The rule will traverse the Momoa AST and check string values at these paths:

- `contributes.commands[*].title`
- `contributes.configuration.title`
- `contributes.configuration.properties.*.description`
- `contributes.configuration.properties.*.markdownDescription`
- `contributes.configuration.properties.*.enumDescriptions[*]`
- `contributes.debuggers[*].label`
- `contributes.debuggers[*].configurationSnippets[*].label`
- `contributes.debuggers[*].configurationSnippets[*].description`
- `contributes.debuggers[*].configurationSnippets[*].body.name`
- `contributes.debuggers[*].configurationAttributes.launch.properties.*.description`
- `contributes.views.*[*].name`
- `contributes.viewsContainers.activitybar[*].title`
- `contributes.walkthroughs[*].title`
- `contributes.walkthroughs[*].description`
- `contributes.walkthroughs[*].steps[*].title`
- `contributes.walkthroughs[*].steps[*].description`
- `contributes.walkthroughs[*].steps[*].media.altText`

**Error conditions:**

1. Value is not `%key%` format (hardcoded string)
2. Key doesn't exist in `package.nls.json` (typo/missing)

**Note:** The top-level `description` field (package description) is intentionally excluded - it's for npm/marketplace, not VS Code UI.

### 3. Export from index

Update [`packages/eslint-local-rules/src/index.ts`](packages/eslint-local-rules/src/index.ts) to export the new rule.

### 4. Configure eslint.config.mjs

Update [`eslint.config.mjs`](eslint.config.mjs):

- Import `@eslint/json` plugin
- Add config block for `packages/*/package.json` files using the JSON parser
- Enable the new rule

### 5. Add tests

Create [`packages/eslint-local-rules/test/packageJsonI18nDescriptions.test.ts`](packages/eslint-local-rules/test/packageJsonI18nDescriptions.test.ts) with:

- Valid: properly i18n'd contributes section
- Invalid: hardcoded string in `contributes.commands[*].title`
- Invalid: `%key%` where key doesn't exist in package.nls.json

## Existing Violations

Current codebase has hardcoded strings that will need fixing:

- `packages/salesforcedx-vscode-services/package.json` - configuration title
- `packages/salesforcedx-vscode-org-browser/package.json` - view title, command titles
- `packages/salesforcedx-vscode-core/package.json` - viewsContainers title

These will be fixed after the rule is implemented - their presence validates the rule works correctly.

## Key Details

- Momoa AST node types: `Document`, `Object`, `Member`, `Array`, `String`, `Number`, `Boolean`, `Null`
- Use `node:fs` to read `package.nls.json` (already allowed in eslint-local-rules per line 567 of eslint.config.mjs)
- Rule only runs on `packages/*/package.json`, not root package.json