---
name: typescript
description: TypeScript coding standards and conventions including file naming rules
---

- no barrel files
- avoid type assertions (`as Foo` or `as unknown as` or `Foo!`). do guards or Effect.schema stuff (ex `is`) instead
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
- preserve comments when refactoring; remove if wrong/obsolete
- exported functions: single-line jsdoc /\*_ foo _/ if name unclear; no params/return (TS provides types)
- look for uses of (Object|Map).groupBy instead of older patterns
