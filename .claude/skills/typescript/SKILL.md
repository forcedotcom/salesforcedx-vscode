---
name: typescript
description: TypeScript coding standards and conventions including file naming rules
---

- no barrel files
- no `void` for async in sync contexts - use async/effect
- no `export *` - name exports explicitly
- prefer `undefined` over null (unless server requires null)
- prefer `undefined` over empty string
- prefer map/filter over loops/conditionals
- avoid mutation
- no enums or namespaces
- .ts files: lower camelCase, no hyphens, no leading capitals
