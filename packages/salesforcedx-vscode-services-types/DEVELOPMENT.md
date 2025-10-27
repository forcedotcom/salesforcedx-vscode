# Development Guide

## Package Overview

This package (`@salesforce/vscode-services`) publishes TypeScript type definitions for the `salesforcedx-vscode-services` extension API. It contains only `.d.ts` files with no runtime code.

The package uses Node.js `exports` field to enforce that only the main `SalesforceVSCodeServicesApi` type is accessible. Internal types and implementation details cannot be directly imported.

## How It Works

### Generated Source

The source code is **not committed** to git. Instead, it's generated on-demand from the parent package:

1. `scripts/generateEntry.ts` creates `src/index.ts` that re-exports only `SalesforceVSCodeServicesApi`
2. TypeScript compiles this along with all referenced types from the parent package
3. The output `out/` directory contains all necessary `.d.ts` files

Scripts are written in TypeScript and executed via `ts-node` for type safety.

### Dependency Sync

Dependencies are automatically synced from the parent package:

```bash
npm run sync-deps
```

This script:

- Reads `../salesforcedx-vscode-services/package.json`
- Extracts all relevant dependencies
- Updates this package's `package.json` with matching versions
- Syncs the version number

### Build Process

```bash
npm run compile
```

This runs:

1. `precompile` → `generate-entry` (creates `src/index.ts`)
2. `tsc` compiles types from both local and parent source

### Publishing

```bash
npm run prepublishOnly
```

Before publishing, this automatically:

1. Syncs dependencies and version from parent
2. Generates source entry point
3. Compiles all types

## Local Testing

### Method 1: Using npm pack

```bash
# Build and pack
npm run compile
npm pack

# Install in test project
cd /path/to/test-project
npm install /path/to/salesforce-vscode-services-X.X.X.tgz

# Test imports
cat > test.ts << 'EOF'
import type { SalesforceVSCodeServicesApi } from '@salesforce/vscode-services';
const api: SalesforceVSCodeServicesApi = {} as any;
EOF

npx tsc --noEmit --skipLibCheck test.ts
```

### Method 2: Using npm link

```bash
# In types package
npm run compile
npm link

# In test project
npm link @salesforce/vscode-services

# Test and unlink when done
npm unlink @salesforce/vscode-services
```

## Keeping in Sync

### Automatic Sync

The types stay in sync automatically because:

- Source is generated from parent on each build
- Dependencies are synced from parent before publish
- Version is synced from parent before publish

### Manual Checks

To verify sync:

```bash
# Check that compilation works
npm run compile

# Check dependencies match parent
npm run sync-deps
git diff package.json  # Should show no changes if already synced

# Check package contents
npm pack --dry-run
```

## CI/CD Integration

### Required Steps

1. **On parent package changes**: Run types package compilation as part of CI
2. **Before release**: Run `npm run prepublishOnly` in types package
3. **Publishing**: Use `npm publish` (prepublishOnly hook ensures everything is synced)

### Validation Script

```bash
# Validate types package is ready for publish
cd packages/salesforcedx-vscode-services-types
npm run clean
npm install
npm run sync-deps
npm run compile
npm pack
```

## Troubleshooting

### Types not resolving correctly

**Problem**: Consumer can't import types
**Solution**: Check `package.json` `types` field points to correct path

### Dependencies out of sync

**Problem**: Version mismatch errors
**Solution**: Run `npm run sync-deps` before publish

### Compilation errors

**Problem**: TypeScript can't find parent types
**Solution**: Ensure `tsconfig.json` includes parent source directory

### Package too large

**Problem**: Package includes unnecessary files
**Solution**: Check `.npmignore` only allows `out/**/*.d.ts` files and required metadata

## File Structure

```text
salesforcedx-vscode-services-types/
├── package.json              # Package metadata, synced version/deps
├── tsconfig.json            # TypeScript config for declaration-only compile
├── .gitignore               # Excludes src/ and out/ (both generated)
├── .npmignore               # Includes only out/**/*.d.ts and metadata
├── README.md                # User-facing documentation
├── DEVELOPMENT.md           # This file
├── LICENSE.txt              # BSD-3-Clause license
├── scripts/
│   ├── generateEntry.ts     # Generates src/index.ts from parent
│   └── syncDeps.ts          # Syncs dependencies/version from parent
├── src/                     # Generated (not in git)
│   └── index.ts             # Re-exports SalesforceVSCodeServicesApi
└── out/                     # Generated (not in git)
    ├── salesforcedx-vscode-services-types/
    │   └── src/
    │       └── index.d.ts   # Entry point (referenced by package.json)
    └── salesforcedx-vscode-services/
        └── src/             # All type definitions from parent
            └── **/*.d.ts
```

## Common Commands

```bash
# Full build from scratch
npm run clean && npm install && npm run compile

# Sync and build
npm run sync-deps && npm run compile

# Test package contents
npm pack --dry-run

# Create tarball
npm pack

# Publish (auto-syncs first)
npm publish
```
