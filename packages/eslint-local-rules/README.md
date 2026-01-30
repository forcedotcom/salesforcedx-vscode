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

### package-json-icon-paths

Validates icon paths in `package.json` `contributes` sections:

- Icon objects must have both `light` and `dark` properties (or neither)
- Referenced icon files must exist on disk

### package-json-command-refs

Validates command references in `package.json`:

- Commands referenced in menus must be defined in `contributes.commands`
- Warns about orphaned commands (defined but never referenced)

### package-json-view-refs

Validates view ID references in `package.json`:

- View IDs in `when` clauses must match defined views in `contributes.views`
- View IDs in `viewsWelcome` must reference defined views

**Note:** These JSON rules require `@eslint/json` to be installed and configured.

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
      'local/package-json-i18n-descriptions': 'error',
      'local/package-json-icon-paths': 'error',
      'local/package-json-command-refs': 'error',
      'local/package-json-view-refs': 'error'
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

## Writing JSON Rules

When writing custom ESLint rules for JSON files using `@eslint/json`, be aware that the AST structure differs from JavaScript/TypeScript.

### Root Node Type

The `@eslint/json` plugin uses `Document` as the root AST node type, **not** `Program`. Your rule visitor must use `Document:exit` (or `Document`):

```typescript
// ❌ WRONG - Program is never called for JSON files
'Program:exit': (node) => { ... }

// ✅ CORRECT - Document is the root node for JSON
'Document:exit': (node) => {
  const ast = node?.body; // The actual JSON content
  ...
}
```

### AST Structure

The JSON AST uses [@humanwhocodes/momoa](https://github.com/humanwhocodes/momoa) node types:

- `Document` - Root node, contains `body` (the JSON value)
- `Object` - JSON object `{}`
- `Array` - JSON array `[]`
- `String`, `Number`, `Boolean`, `Null` - Primitive values
- `Member` - Key-value pair in an object (has `name` and `value`)
- `Element` - Item in an array (has `value`)

Example traversal:

```typescript
const findNodeAtPath = (node: ValueNode, pathSegments: string[]): ValueNode[] => {
  if (pathSegments.length === 0) return [node];
  const [key, ...rest] = pathSegments;

  if (node.type === 'Object') {
    const member = node.members.find(m => m.name.value === key);
    return member ? findNodeAtPath(member.value, rest) : [];
  }

  if (node.type === 'Array' && key === '*') {
    return node.elements.flatMap(el => findNodeAtPath(el.value, rest));
  }

  return [];
};
```

### Testing JSON Rules

JSON rules can be unit tested using ESLint's `Linter` class with flat config:

```typescript
import { Linter } from 'eslint';
import * as json from '@eslint/json';
import { myJsonRule } from '../src/myJsonRule';

const linter = new Linter({ configType: 'flat' });

const lintJson = (code: string, filename = 'packages/test/package.json') => {
  const config = [
    {
      files: ['**/*.json'],
      plugins: {
        // IMPORTANT: include both rules AND languages from @eslint/json
        json: { rules: json.rules, languages: json.languages },
        local: { rules: { 'my-json-rule': myJsonRule } }
      },
      language: 'json/json',
      rules: { 'local/my-json-rule': 'error' }
    }
  ];
  return linter.verify(code, config, { filename });
};

// Use in tests:
const messages = lintJson('{"invalid": "json"}');
expect(messages).toHaveLength(1);
```
