# Development Guide

## Package Overview

This package (`@salesforce/vscode-services`) publishes the frozen V3 external API at its root and the V4 API at `/v2`. It contains declarations and shared type-level constants; the runtime implementation belongs to `salesforcedx-vscode-services`.

The package `exports` map exposes only the legacy root API, the `/v2` API, and their explicit supported subpaths. Internal types and implementation details cannot be directly imported.

## How It Works

### Generated Source

The V1 root declaration source is generated on demand from the frozen V3 compatibility surface. V2 declarations are maintained under `v2/`:

1. `scripts/generateEntry.mts` reads `salesforcedx-vscode-services-v3-compat/out/externalServices.d.cts`, rewrites Effect imports to the `effect-v3` alias, and generates `src/index.ts` plus `src/externalServices.d.ts`.
2. `scripts/syncDeps.mts` updates only the package version from the services extension. The frozen V3 dependency set is intentionally not copied from the V4 provider.
3. TypeScript compiles the root V3 declarations and the separate `v2/` V4 declarations into `out/`.

Scripts require Node.js 24.18+ and run directly, without `ts-node` or a loader:

```bash
node packages/salesforcedx-vscode-services-types/scripts/generateEntry.mts
node packages/salesforcedx-vscode-services-types/scripts/syncDeps.mts
```

Run these from the repository root. Paths resolve relative to each script, not the working directory. `npm run check:scripts` checks their types separately with NodeNext and erasable-only syntax.

### Dependency Sync

The package has two deliberate dependency groups: V4 dependencies for `/v2`, and a pinned Effect V3 alias for the frozen root declarations. Only the package version is synced from the services extension:

```bash
npm run sync-deps
```

This script:

- Reads `../salesforcedx-vscode-services/package.json`
- Updates this package's version
- Preserves the V3 compatibility dependency pins and the separate V4 dependencies

### Build Process

```bash
npm run compile
```

This runs:

1. The compatibility package compiles the frozen V3 subset.
2. Wireit's `generate-src` runs `generateEntry.mts` and `syncDeps.mts`.
3. `compile:legacy` builds the root V3 declarations; `compile:v2` builds the V4 declarations.

### Publishing

```bash
# from the top-level of the repo, not the project
npm run compile
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

### Automated Publishing

The package is automatically published to npm when a GitHub release is created via the `.github/workflows/publishNpmTypes.yml` workflow.

**Workflow Steps:**

1. **Version Validation**: Compares release tag (e.g., `v64.4.0`) with `package.json` version
2. **Pre-publish**: Runs `prepublishOnly` script which:
   - Syncs dependencies and version from parent package
   - Generates source entry point
   - Compiles all TypeScript declarations
3. **Publish**: Publishes package to npm with public access

**Requirements:**

- `NPM_TOKEN` secret must be configured in repository settings
- Release tag must match the version in parent `salesforcedx-vscode-services/package.json`
- Package version will be auto-synced from parent during publish

**Triggering:**

- Automatic: When a GitHub release is published (not pre-release)
- Manual: Via workflow_dispatch button in GitHub Actions UI

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
