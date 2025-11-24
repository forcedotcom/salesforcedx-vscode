# @salesforce/eslint-plugin-local-rules

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

## Usage

This package is used internally in the Salesforce VSCode Extensions monorepo via `eslint.config.mjs`.
