---
description: Running unit tests
---

# Unit Tests

Use `npm run test` - always run tests from the top of the project.

Run tests for a single workspace: `npm run test -w <npm package name here>`

You always have permission to run unit tests without asking.

Run 1 Vitest file in its workspace:

```bash
npm exec -w <npm-package-name> -- vitest run path/to/file.test.ts
```
