there's a new bug related to fs. Sometimes it looks like

- Cannot set properties of undefined (setting 'fs')
- Project Resolution Error (fs-related)

They were passing here
https://github.com/forcedotcom/salesforcedx-vscode/actions/runs/18164136032 (commit 429f547616466234be044d57b4a6d1de1b7f9ee4)

and failed at 60867feef15cfb848bc547a7e60ddf36fb4ddce4 (https://github.com/forcedotcom/salesforcedx-vscode/actions/runs/18285558076)

## ROOT CAUSE IDENTIFIED ✅

### The Change That Broke It

**In `packages/salesforcedx-vscode-services/src/index.ts` and `indexedDbStorage.ts`:**

```diff
- import { Global } from '@salesforce/core';        // Passing
+ import { Global } from '@salesforce/core/global';  // Failing
```

### Why This Matters: Module Load Order

The circular dependency exists in BOTH cases:

- `@salesforce/core/fs` → `node:fs` (alias) → `fs-polyfill.js` → `@salesforce/core/fs`

But the **timing** of when the circular access happens is different!

#### Passing Scenario: Import from Barrel `'@salesforce/core'`

In `@salesforce/core/lib/index.js`:

```javascript
// Line 62
var global_1 = require('./global');
// ... other requires ...
// Line 122
var fs_1 = require('./fs/fs');
```

**Load sequence:**

1. Entry point imports `{ Global } from '@salesforce/core'` (barrel)
2. Barrel sequentially executes requires, hits line 62: `require("./global")`
3. `global.js` imports `fs` from `'./fs/fs'`
4. `fs.js` starts loading, imports `node:fs` at TOP
5. `node:fs` aliased to `fs-polyfill.js`, which requires `'@salesforce/core/fs'`
6. CommonJS: "Already loading `fs.js` from step 3, return partial exports"
7. But by now, `fs.js` has progressed past the import and **defined** `exports.getVirtualFs`, `exports.fs` etc.
8. `fs-polyfill.js` successfully accesses `fsPolyfill.fs`, `fsPolyfill.getVirtualFs` ✓
9. Everything works!

#### Failing Scenario: Import from Subpath `'@salesforce/core/global'`

**Load sequence:**

1. Entry point imports `{ Global } from '@salesforce/core/global'` (direct, bypasses barrel)
2. `global.js` imports `fs` from `'./fs/fs'`
3. `fs.js` starts loading, **IMMEDIATELY** imports `node:fs` at TOP (first executable line)
4. `node:fs` aliased to `fs-polyfill.js`, which requires `'@salesforce/core/fs'`
5. CommonJS: "Already loading `fs.js` from step 2, return partial exports"
6. But we're **still at line 1** of `fs.js` (the import line)!
7. `exports.getVirtualFs`, `exports.fs` etc. **haven't been defined yet**
8. `fs-polyfill.js` accesses `fsPolyfill.fs` = **undefined** ✗
9. Later when `fs.js` tries to initialize: `exports.fs = getVirtualFs()` but `exports` is broken
10. Error!

### The Critical Difference

**Barrel import:** The barrel's sequential loading means other modules get loaded first, advancing `fs.js` execution before the circular access.

**Direct import:** Goes straight to `global.js` → `fs.js`, and the circular access happens at the very first line before any exports are defined.

## THE FIX ✅

### Applied Changes

Reverted to barrel imports in:

1. `packages/salesforcedx-vscode-services/src/index.ts`
2. `packages/salesforcedx-vscode-services/src/virtualFsProvider/indexedDbStorage.ts`

```typescript
// Changed from:
import { Global } from '@salesforce/core/global';

// Back to:
import { Global } from '@salesforce/core';
```

### Test Results

**Before fix (subpath import):**

- ❌ All 5 e2e tests failed
- Error: "Cannot set properties of undefined (setting 'fs')"
- Error: "sfdx-project.json not found"

**After fix (barrel import):**

- ✅ All 5 e2e tests passed
- No activation errors
- File system working correctly

```
✓  5 [chromium] › orgBrowser.describe.scratch.spec.ts
✓  4 [chromium] › orgBrowser.load.smoke.spec.ts
✓  3 [chromium] › orgBrowser.customTab.headless.spec.ts
✓  2 [chromium] › orgBrowser.folderedReport.headless.spec.ts
✓  1 [chromium] › orgBrowser.customObject.headless.spec.ts

5 passed (45.6s)
```

## Long-Term Considerations

While using the barrel import fixes the immediate issue, the circular dependency still exists. Future considerations:

1. **Avoid direct subpath imports of `Global`**: Always use `import { Global } from '@salesforce/core'`

2. **Upstream fix in @salesforce/core**: Could lazy-load `node:fs` to break the circular dependency:

   ```typescript
   // Instead of: import * as nodeFs from 'node:fs';
   const getNodeFs = () => require('node:fs');
   ```

3. **Alternative polyfill strategy**: Could redesign `fs-polyfill.js` to not require `@salesforce/core/fs`, but this requires solving the shared memfs instance problem.

4. **Document the constraint**: Add a comment/lint rule to prevent future changes from using subpath imports that bypass the barrel.

## Key Learnings

1. **Circular dependencies can be "hidden" by load order**: The same circular dependency can work or fail depending on when the circular access occurs during module initialization.

2. **Barrel files control initialization order**: By loading modules sequentially, barrel files can ensure dependencies are sufficiently initialized before circular accesses occur.

3. **Subpath imports bypass barrels**: TypeScript package exports allow direct imports like `'@salesforce/core/global'`, but these bypass the barrel's initialization order guarantees.

4. **CommonJS returns partial exports**: When a circular dependency is detected, CommonJS returns the exports object as it exists at that moment, which may be incomplete.
