# ESLint Rule to Prevent Direct Imports from Services Extension

## Overview
Create a new ESLint rule that blocks direct imports from `salesforcedx-vscode-services` in the `salesforcedx-vscode-metadata` package, while allowing type-only imports.

## Import Syntax Requirements

The rule must handle these cases:

1. ✅ `import type {foo, bar} from 'salesforcedx-vscode-services/...'` - OK (all types via `import type`)
2. ❌ `import {foo, type bar} from 'salesforcedx-vscode-services/...'` - NOT OK (foo is a non-type import)
3. ✅ `import {type foo, type bar} from 'salesforcedx-vscode-services/...'` - OK (all specifiers are type-only)

## Implementation Steps

### 1. Create the Rule File
Create `packages/eslint-local-rules/src/noDirectServicesImports.ts`:
- Use `RuleCreator.withoutDocs` pattern (similar to existing rules)
- Check `ImportDeclaration` nodes
- Detect imports from `salesforcedx-vscode-services` (any path)
- Check `importKind === 'type'` on the ImportDeclaration (for `import type` syntax)
- For regular imports, check ALL specifiers:
  - If any `ImportSpecifier` has `importKind !== 'type'`, it's an error
  - If all specifiers have `importKind === 'type'`, it's OK
- Report error with message suggesting to use `import type` or make all specifiers type-only

### 2. Register the Rule
Update `packages/eslint-local-rules/src/index.ts`:
- Import the new rule
- Add it to the `rules` object with key `'no-direct-services-imports'`

### 3. Configure ESLint
Update `eslint.config.mjs`:
- Add the rule to the Effect-specific rules section (lines 509-564) that already targets `packages/salesforcedx-vscode-metadata/**/*.ts`
- Set rule to `'error'` level
- Optionally exclude test files if needed (test files already have relaxed rules at lines 567-588)

## Files to Modify
- `packages/eslint-local-rules/src/noDirectServicesImports.ts` (new file)
- `packages/eslint-local-rules/src/index.ts` (add rule registration)
- `eslint.config.mjs` (add rule configuration for metadata package)

## Example Violations
```typescript
// ❌ Should error - non-type import
import { EditorService } from 'salesforcedx-vscode-services/src/vscode/editorService';

// ❌ Should error - mixed import (foo is non-type)
import { foo, type EditorService } from 'salesforcedx-vscode-services/src/vscode/editorService';

// ✅ Should pass - all types via import type
import type { EditorService } from 'salesforcedx-vscode-services/src/vscode/editorService';

// ✅ Should pass - all specifiers are type-only
import { type EditorService, type NoActiveEditorError } from 'salesforcedx-vscode-services/src/vscode/editorService';
```

## Testing
The rule should catch the existing violation in `packages/salesforcedx-vscode-metadata/src/commands/deploySourcePath.ts:9` and allow the type-only import in `deployManifest.ts:10`.
