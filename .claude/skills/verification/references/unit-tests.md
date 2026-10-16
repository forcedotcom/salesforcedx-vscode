---
description: Running unit tests
---

# Unit Tests

Unit tests live under `test/unit` (Vitest). Jest only for `test/integration`.

Use `npm run test` — always from repo root.

Single workspace: `npm run test -w <npm package name here>`

Permission to run unit tests without asking: always.

One Vitest file:

```bash
npm exec -w <npm-package-name> -- vitest run test/unit/path/to/file.test.ts
```
