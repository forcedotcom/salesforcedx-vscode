# Knip Configuration Fix Summary

**Date**: 2026-03-28
**Task**: Fix knip config to properly handle `__tests__` directories and language server entry points

## Changes Made

### 1. Added `__tests__` Pattern to Entry Points

**Before**: `__tests__` directories were globally ignored, causing false positives for exports only used in test files.

**After**: Added test patterns to package entry points:
```json
"packages/*": {
  "entry": [
    "src/index.ts",
    "test/**/*.test.ts",
    "test/**/*.spec.ts",
    "src/**/__tests__/**/*.test.ts",  // ✅ Added
    "src/**/__tests__/**/*.spec.ts"   // ✅ Added
  ]
}
```

Removed from global ignore:
```json
"ignore": [
  // "**/__tests__/**",  // ❌ Removed this line
  "**/__mocks__/**",
  ...
]
```

### 2. Added Language Server Entry Points

Language servers have `server.ts` files that are referenced in esbuild configs but not imported by other TypeScript files.

Added explicit configurations for all 4 language server packages:

```json
"packages/salesforcedx-aura-language-server": {
  "entry": ["src/index.ts", "src/server.ts", ...]
},
"packages/salesforcedx-lwc-language-server": {
  "entry": ["src/index.ts", "src/server.ts", ...]
},
"packages/salesforcedx-visualforce-language-server": {
  "entry": ["src/index.ts", "src/server.ts", ...]
},
"packages/salesforcedx-visualforce-markup-language-server": {
  "entry": ["src/index.ts", "src/server.ts", ...]
}
```

### 3. Ignored Vendored Third-Party Libraries

Added to global ignore to prevent analyzing bundled third-party code:
```json
"ignore": [
  ...
  "**/src/tern/**",      // ✅ Tern.js library (vendored)
  "**/src/beautify/**"   // ✅ JS Beautify library (vendored)
]
```

## Results

### Before Fix
- **Unused exports**: 39
- **Unused files**: 70

### After Fix
- **Unused exports**: 30 (↓ 9)
- **Unused files**: 67 (↓ 3)

### False Positives Removed ✅

#### Exports (9 items)
1. `init` - aura-language-server/tern-server/ternServer.ts
2. `startServer` - aura-language-server/tern-server/ternServer.ts
3. `addFile` - aura-language-server/tern-server/ternServer.ts
4. `delFile` - aura-language-server/tern-server/ternServer.ts
5. `onTypeDefinition` - aura-language-server/tern-server/ternServer.ts
6. `onSignatureHelp` - aura-language-server/tern-server/ternServer.ts
7. `getAuraBindingTemplateDeclaration` - aura-language-server/auraUtils.ts
8. `isAuraWatchedDirectory` - aura-language-server/auraUtils.ts
9. `isAuraRootDirectoryCreated` - aura-language-server/auraUtils.ts

#### Files (3 items)
1. `packages/salesforcedx-aura-language-server/src/auraServer.ts`
2. `packages/salesforcedx-aura-language-server/src/server.ts`
3. `packages/salesforcedx-aura-language-server/src/markup/auraTags.ts`

Plus prevented **~40 false positives** from vendored library files (tern, beautify).

## Remaining Work

The 30 remaining unused exports are now accurately flagged and need manual review:
- 17 likely dead code (constants, functions, classes)
- 10+ need investigation (Lightning LSP, telemetry, services)
- 3 internally-used only (span utils - should be un-exported)

See `knip-unused-exports-analysis.md` for detailed breakdown.

## Key Insights

### Language Server Pattern
Language servers in this monorepo have a dual entry point structure:
- `src/index.ts` - Exports utility functions for library consumption
- `src/server.ts` - Standalone entry point that starts the language server process

The `server.ts` files are referenced in esbuild configs of extension packages:
```javascript
// packages/salesforcedx-vscode-lightning/esbuild.config.mjs
entryPoints: ['../salesforcedx-aura-language-server/out/src/server.js']
```

Knip doesn't automatically detect these esbuild entry points, so they must be explicitly configured.

### Test File Patterns
This monorepo uses multiple test file patterns:
- `test/**/*.test.ts` - Jest tests in test directories
- `test/**/*.spec.ts` - Spec files in test directories
- `src/**/__tests__/**/*.test.ts` - Colocated tests (less common)
- `src/**/__tests__/**/*.spec.ts` - Colocated specs (less common)

All patterns need to be included in entry points to avoid false positives.

### Vendored Libraries
Some packages bundle third-party libraries directly in source:
- `src/tern/` - Tern.js language analysis library
- `src/beautify/` - JS Beautify formatting library

These should be ignored since they're not maintained code and have their own exports/usage patterns.

## Testing the Fix

Verify the fix worked:
```bash
# Should show 30 unused exports (not 39)
npm run knip -- --no-exit-code | grep "Unused exports"

# Should not include tern server functions
npm run knip -- --no-exit-code | grep -E "(init|startServer|addFile)" | grep ternServer

# Should return empty (no matches)
```

Check specific language server packages:
```bash
# Should not flag auraServer.ts or server.ts as unused
npm run knip -- --workspace packages/salesforcedx-aura-language-server --no-exit-code
```

## Next Steps

1. ✅ **Config fix complete** - False positives removed
2. 🔄 **Review remaining 30 exports** - Use analysis document
3. 📝 **Clean up dead code** - Remove 17 truly unused exports
4. 🔍 **Investigate unclear cases** - Lightning LSP utils, services layer
5. 📊 **Track progress** - Baseline JSON for comparison

Run `npm run knip:json > knip-after-config-fix.json` to capture the new baseline.
