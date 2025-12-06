---
name: Upgrade Zod to v4
overview: Update salesforcedx-utils-vscode package to use Zod v4, fixing the breaking changes in error message syntax.
todos: []
---

# Upgrade Zod to v4

## Changes Required

### 1. Update package.json dependency

Update [`packages/salesforcedx-utils-vscode/package.json`](packages/salesforcedx-utils-vscode/package.json) to use Zod v4:

- Change `"zod": "3.25.76"` to `"zod": "^4.1.12"` (matching the version already used by other dependencies)

### 2. Fix breaking changes in telemetry.ts

Update [`packages/salesforcedx-utils-vscode/src/services/telemetry.ts`](packages/salesforcedx-utils-vscode/src/services/telemetry.ts) line 370-376:

- Change `message` parameter to `error` parameter in Zod v4
- Reference: [Zod v4 Changelog](https://zod.dev/v4/changelog) and [Error Customization](https://zod.dev/error-customization)

**Before:**

```typescript
const extensionPackageJsonSchema = z.object({
  name: z.string({ message: 'Extension name is not defined in package.json' }),
  version: z.string({ message: 'Extension version is not defined in package.json' }),
  aiKey: z.string().optional(),
  o11yUploadEndpoint: z.string().optional(),
  enableO11y: z.string().optional()
});
```

**After:**

```typescript
const extensionPackageJsonSchema = z.object({
  name: z.string({ error: 'Extension name is not defined in package.json' }),
  version: z.string({ error: 'Extension version is not defined in package.json' }),
  aiKey: z.string().optional(),
  o11yUploadEndpoint: z.string().optional(),
  enableO11y: z.string().optional()
});
```

### 3. No changes needed for activationTrackerUtils.ts

The usage in [`packages/salesforcedx-utils-vscode/src/helpers/activationTrackerUtils.ts`](packages/salesforcedx-utils-vscode/src/helpers/activationTrackerUtils.ts) (line 22-28) uses basic `z.object()` and `z.string()` which remain compatible in v4.

### 4. Run validation steps

After changes, run the standard validation workflow from repo root:

1. `npm install` - update dependencies
2. `npm run compile` - verify compilation
3. `npm run lint` - check linting
4. `npm run test` - run tests
5. `npx knip` - check for dead code