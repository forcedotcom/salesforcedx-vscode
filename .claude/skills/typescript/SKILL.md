---
name: typescript
description: TypeScript coding standards and conventions including file naming rules
---

- no barrel files
- no `void` for async - use async/effect (exception [vscode-window-messages](../vscode-window-messages/SKILL.md))
- no `export *` - name exports explicitly
- prefer `undefined` over null (unless server requires null)
- prefer `undefined` over empty string
- prefer map/filter over loops/conditionals
- avoid mutation
- avoid `any`
- no enums or namespaces (enums compile to weird JS; use string union types instead; exception: interfaces defined outside this repo that we can't change)
- no runtime errors for developer mistakes (use types to ensure exhaustive switch/case; don't throw for null/undefined when input/consumer is within our control)
- .ts filenames: camelCase, no hyphens, no leading capitals
- preserve comments when refactoring; remove/fix if wrong/obsolete
- exported functions: single-line jsdoc /\*_ foo _/ if name unclear; no params/return (TS provides types)
- look for uses of (Object|Map).groupBy instead of older patterns
- redundant empty-collection guards: if `arr.find/some/every/map/filter/reduce` already returns the same value for an empty array, drop the `if (arr.length === 0) return …` guard. e.g. `find` on `[]` is `undefined`, so guarding `return undefined` is dead code.
- no needless const declarations: return directly instead of `const x = val; return x` (exception: complex expressions where const improves readability)
