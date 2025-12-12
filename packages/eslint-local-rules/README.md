# @salesforce/eslint-plugin-vscode-extensions

Custom ESLint rules for Salesforce VSCode extensions.

## Rules

### no-duplicate-i18n-values

Disallows English text in translation files that should be localized. This rule checks i18n locale files (e.g., `i18n.ja.ts`) and flags any translations that appear to be in English or duplicate the English source text.

### no-vscode-message-literals

Enforces that `vscode.window.show*Message` calls use localized strings via `nls.localize()` or variables, not string literals.

**Bad:**

```typescript
vscode.window.showErrorMessage('An error occurred');
vscode.window.showWarningMessage(`Failed: ${error}`);
```

**Good:**

```typescript
vscode.window.showErrorMessage(nls.localize('error_message'));
const msg = nls.localize('error_with_details', error);
vscode.window.showWarningMessage(msg);
vscode.window.showErrorMessage(`${nls.localize('prefix')} - ${details}`);
```

The rule allows template literals that contain `nls.localize()` calls.

### package-json-i18n-descriptions

Enforces that user-facing strings in `package.json` `contributes` sections use i18n placeholders (`%key%`) and that those keys exist in the sibling `package.nls.json` file.

**Note:** This rule requires `@eslint/json` to be installed and configured in your ESLint config to parse JSON files.

## Usage

### Installation

```bash
npm install --save-dev @salesforce/eslint-plugin-vscode-extensions @eslint/json
```

### Configuration

In your `eslint.config.mjs` (or `eslint.config.js`):

```javascript
import jsonPlugin from '@eslint/json';
import localRulesPlugin from '@salesforce/eslint-plugin-vscode-extensions';

export default [
  // Register JSON plugin
  {
    plugins: {
      json: jsonPlugin
    }
  },
  // Enable JSON linting for package.json files
  {
    files: ['**/package.json'],
    language: 'json/json',
    plugins: {
      json: jsonPlugin,
      local: localRulesPlugin
    },
    rules: {
      'local/package-json-i18n-descriptions': 'error'
    }
  }
];
```

**Why `@eslint/json` is a peerDependency:**

The rule itself doesn't import `@eslint/json` - it only works with AST nodes that ESLint provides. However, `@eslint/json` is required in your ESLint configuration to:
1. Register the JSON language parser
2. Enable ESLint to parse JSON files

This is a peerDependency (not a regular dependency) because:
- The rule doesn't directly import it
- Users need to configure it in their ESLint config
- It allows users to control the version they use
- npm will warn if it's missing during installation

This package is also used internally in the Salesforce VSCode Extensions monorepo via `eslint.config.mjs`.
