---
name: typescript
description: TypeScript coding standards and conventions including file naming rules
---

- no barrel files
- no `void` for async - use async/effect
- no `export *` - name exports explicitly
- prefer `undefined` over null (unless server requires null)
- prefer `undefined` over empty string
- prefer map/filter over loops/conditionals
- avoid mutation
- no enums or namespaces
- .ts filenames: camelCase, no hyphens, no leading capitals
- preserve comments when refactoring; remove if wrong/obsolete
- exported functions: single-line jsdoc /\*_ foo _/ if name unclear; no params/return (TS provides types)
