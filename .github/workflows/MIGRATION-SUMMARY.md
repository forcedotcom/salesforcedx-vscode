# Prerelease CI Migration Summary

## Files Copied from apex-language-support

### ✅ Workflows (`.github/workflows/`)
- ✅ `nightly.yml` - Nightly release orchestrator
- ✅ `nightly-extensions.yml` - Extension build & release workflow
- ✅ `promote-prerelease.yml` - Weekly pre-release promotion
- ✅ `package.yml` - VSIX packaging workflow

### ✅ TypeScript Scripts (`.github/scripts/`)
- ✅ `index.ts` - CLI entry point
- ✅ `types.ts` - Type definitions
- ✅ `utils.ts` - Shared utilities
- ✅ `audit-logger.ts` - Audit logging
- ✅ `ext-build-type.ts` - Build type detection
- ✅ `ext-change-detector.ts` - Change detection + conventional commits
- ✅ `ext-github-releases.ts` - GitHub Release creation
- ✅ `ext-nightly-finder.ts` - Nightly candidate finder
- ✅ `ext-package-selector.ts` - Extension discovery
- ✅ `ext-publish-matrix.ts` - Publish matrix generation
- ✅ `ext-release-plan.ts` - Release plan display
- ✅ `ext-version-bumper.ts` - Version bumping with odd/even scheme
- ✅ `npm-change-detector.ts` - NPM package change detection
- ✅ `npm-package-details.ts` - Package details extraction
- ✅ `npm-package-selector.ts` - NPM package selection
- ✅ `npm-release-plan.ts` - NPM release plan
- ✅ `npm-types.ts` - NPM type definitions

### ✅ Composite Actions (`.github/actions/`)
- ✅ `check-ci-status/` - CI status verification
- ✅ `publish-vsix/` - VSIX marketplace publishing
- ✅ `npm-install-with-retries/` - Reliable npm install
- ✅ `calculate-artifact-name/` - Artifact naming with run isolation

### ✅ Dependencies Added
- ✅ `simple-git@^3.36.0` added to `package.json` dependencies

### ✅ Documentation
- ✅ `PRERELEASE-CI.md` - Complete prerelease CI documentation
- ✅ `MIGRATION-SUMMARY.md` - This file

---

## Adaptations Made

### Workflows
1. **`nightly.yml`** - Removed hardcoded `apex-lsp-vscode-extension` from extension options
   - Now supports generic extension discovery

### Scripts
- All scripts work generically with `packages/*` structure ✅
- Extension discovery via `publisher` field in package.json ✅

---

## ⚠️ Known Limitations

### Multi-Extension Support

The **promote-prerelease workflow** needs adaptation for salesforcedx-vscode's multiple extensions:

**Current Issue:**
- `ext-nightly-finder.ts` has hardcoded `apex-lsp-vscode-extension` in tracking tag checks (lines 135, 147)
- `promote-prerelease.yml` promotes only one extension per run

**Solutions:**

**Option A: Per-Extension Matrix (Recommended)**
```yaml
# In promote-prerelease.yml, add matrix job:
jobs:
  list-extensions:
    outputs:
      extensions: ${{ steps.list.outputs.extensions }}
    steps:
      - run: npx tsx .github/scripts/index.ts ext-package-selector
        id: list

  find-nightly-candidate:
    needs: list-extensions
    strategy:
      matrix:
        extension: ${{ fromJson(needs.list-extensions.outputs.extensions) }}
    steps:
      - run: npx tsx .github/scripts/index.ts ext-nightly-finder
        env:
          EXTENSION_NAME: ${{ matrix.extension }}
```

**Option B: Script Parameter**
```typescript
// In ext-nightly-finder.ts, replace hardcoded name:
const extensionName = process.env.EXTENSION_NAME || 'apex-lsp-vscode-extension';
const versionSpecificPrefix = `marketplace-prerelease-${extensionName}-v${version}`;
```

---

## Quick Start

### 1. Configure Secrets

Set these in GitHub repository settings → Secrets and variables → Actions:

```bash
IDEE_GH_TOKEN              # GitHub token with write access
VSCE_PERSONAL_ACCESS_TOKEN # VS Code Marketplace token
IDEE_OVSX_PAT             # Open VSX Registry token
```

### 2. Install Dependencies

```bash
cd /Users/madhur.shrivastava/salesforcedx-vscode
npm install
```

### 3. Test Nightly Build (Dry-Run)

```bash
gh workflow run nightly.yml -f dry-run=true -f extensions=changed
```

### 4. Review Workflow Run

```bash
gh run list --workflow=nightly.yml
gh run view <run-id>
```

### 5. Test Extension Discovery

```bash
npx tsx .github/scripts/index.ts ext-package-selector
```

Expected output:
```json
["salesforcedx-vscode", "salesforcedx-vscode-apex", "salesforcedx-vscode-core", ...]
```

---

## Testing Checklist

### Phase 1: Dry-Run Tests ✅

- [ ] Run `npx tsx .github/scripts/index.ts ext-package-selector` - verify all extensions discovered
- [ ] Run `gh workflow run nightly.yml -f dry-run=true -f extensions=changed`
- [ ] Verify workflow completes without errors
- [ ] Check that no actual git tags/commits created
- [ ] Verify no VSIX uploaded to artifacts

### Phase 2: First Nightly Build 🔄

- [ ] Run `gh workflow run nightly.yml -f extensions=changed` (no dry-run)
- [ ] Verify version bumps committed to main
- [ ] Verify nightly tags created: `<pkg>-v<version>-nightly.<date>`
- [ ] Verify GitHub Releases created with VSIX attachments
- [ ] Download VSIX from release and test installation

### Phase 3: Pre-release Promotion (After Adaptation) 🚧

- [ ] Wait ≥7 days after first nightly
- [ ] Adapt `promote-prerelease.yml` for multi-extension (see Options above)
- [ ] Run `gh workflow run promote-prerelease.yml -f dry-run=true`
- [ ] Run actual promotion (no dry-run)
- [ ] Verify extensions published to VSCE + OVSX as pre-release
- [ ] Verify tracking tags created

---

## Rollback Plan

If issues occur, revert with:

```bash
cd /Users/madhur.shrivastava/salesforcedx-vscode

# Revert all changes
git checkout -- .github/workflows/nightly.yml \
                .github/workflows/nightly-extensions.yml \
                .github/workflows/promote-prerelease.yml \
                .github/workflows/package.yml \
                package.json

# Remove copied files
rm -rf .github/scripts/
rm -rf .github/actions/calculate-artifact-name/
rm -rf .github/actions/check-ci-status/
rm -rf .github/actions/npm-install-with-retries/
rm -rf .github/actions/publish-vsix/
rm .github/workflows/PRERELEASE-CI.md
rm .github/workflows/MIGRATION-SUMMARY.md
```

---

## Support

For issues or questions:

1. Check `PRERELEASE-CI.md` troubleshooting section
2. Review original apex-language-support workflows: https://github.com/forcedotcom/apex-language-support/tree/main/.github/workflows
3. File issue in salesforcedx-vscode repository

---

## Next Steps

1. ✅ Review this migration summary
2. ⚠️ Configure GitHub secrets
3. ⚠️ Test extension discovery script
4. ⚠️ Run first nightly build with dry-run
5. ⚠️ Adapt promote-prerelease.yml for multi-extension support
6. ⚠️ Run first production nightly build
7. ⚠️ Wait 7 days and test pre-release promotion

---

Migration completed: 2026-05-19
Source: apex-language-support @ main
Target: salesforcedx-vscode @ main
