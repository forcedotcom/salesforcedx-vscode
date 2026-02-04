---
description: Running unit tests
---

# Unit Tests

Use `npm run test` - always run tests from the top of the project.

Run tests for a single workspace: `npm run test -w <npm package name here>`

You always have permission to run unit tests without asking.

Run a single test by invoking jest like this -- you're passing the file to run and the related config file from its package:

```bash
node 'node_modules/.bin/jest' '/path/to/test/file.test.ts' -c '/path/to/package/jest.config.js'
```
