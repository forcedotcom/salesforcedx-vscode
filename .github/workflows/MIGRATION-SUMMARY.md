# Prerelease CI Migration Summary

## Files Copied from apex-language-support

### ✅ Workflows (`.github/workflows/`)
- ✅ `nightly.yml` — Nightly release orchestrator
- ✅ `nightly-extensions.yml` — Extension build & release
- ✅ `promote-prerelease.yml` — Weekly pre-release promotion
- ✅ `package.yml` — VSIX packaging

### ✅ TypeScript Scripts
**Not copied** — `nightly.yml` uses shared reusable workflow `salesforcecli/github-workflows/.github/workflows/vscode-publish-extensions.yml@main`, downloads scripts at runtime via curl.

### ✅ Composite Actions (`.github/actions/`)
- ✅ `check-ci-status/` → shared via `salesforcecli/github-workflows@ms/shared-ci-actions`
- ✅ `publish-vsix/` → shared via `salesforcecli/github-workflows@ms/shared-ci-actions`
- ✅ `npm-install-with-retries/` → uses `npmInstallWithRetries@main` from github-workflows
- ✅ `calculate-artifact-name/` → shared via `salesforcecli/github-workflows@ms/shared-ci-actions`

### ✅ Dependencies
- ✅ `simple-git@^3.36.0` added

### ✅ Documentation
- ✅ `PRERELEASE-CI.md` — [Complete prerelease CI guide](./PRERELEASE-CI.md)
- ✅ `MIGRATION-SUMMARY.md` — This file

---

## Adaptations Made

### Workflows
1. **`nightly.yml`** — Removed hardcoded `apex-lsp-vscode-extension`; supports generic extension discovery

### Scripts
- Generic `packages/*` structure support ✅
- Extension discovery via `publisher` field ✅

### Shared Actions Migration (2026-07-16)

3 composite actions moved to `salesforcecli/github-workflows@ms/shared-ci-actions`:
- `check-ci-status`, `calculate-artifact-name`, `publish-vsix`
- Local `npm-install-with-retries` → `npmInstallWithRetries@main`

Both repos reference shared versions. When `ms/shared-ci-actions` merges to `main`:
1. Update workflow refs from `@ms/shared-ci-actions` → `@main`
2. Test in apex-language-support & salesforcedx-vscode
3. Verify CI status, artifact naming, VSIX publishing end-to-end

---

## ⚠️ Known Issues

### 1. Multi-Extension Support

`promote-prerelease.yml` & `ext-nightly-finder.ts` need adaptation for multi-extension (currently designed for single extension like apex-language-support).

**Current issue:** Hardcoded `apex-lsp-vscode-extension` in `ext-nightly-finder.ts` lines 135, 147; promotes 1 extension/run.

**Option A: Per-Extension Matrix (Recommended)**
```yaml
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
const extensionName = process.env.EXTENSION_NAME || 'apex-lsp-vscode-extension';
const versionSpecificPrefix = `marketplace-prerelease-${extensionName}-v${version}`;
```

---

## Quick Start

### 1. Configure Secrets

GitHub → Settings → Secrets and variables → Actions:
- `IDEE_GH_TOKEN` — GitHub token (write access)
- `VSCE_PERSONAL_ACCESS_TOKEN` — VS Code Marketplace token
- `IDEE_OVSX_PAT` — Open VSX Registry token

### 2. Install Dependencies

```bash
npm install
```

### 3. Test Nightly Build (Dry-Run)

```bash
gh workflow run nightly.yml -f dry-run=true -f extensions=changed
```

### 4. Review Workflow Run

```bash
gh run list --workflow=nightly.yml && gh run view <run-id>
```

### 5. Test Extension Discovery

```bash
npx tsx .github/scripts/index.ts ext-package-selector
```
Expected: `["salesforcedx-vscode", "salesforcedx-vscode-apex", ...]`

---

## Testing Checklist

### Phase 1: Dry-Run Tests

- [ ] Extension discovery: `npx tsx .github/scripts/index.ts ext-package-selector`
- [ ] Dry-run: `gh workflow run nightly.yml -f dry-run=true -f extensions=changed`
- [ ] No errors, no tags/commits, no VSIX uploaded

### Phase 2: First Nightly Build

- [ ] Run: `gh workflow run nightly.yml -f extensions=changed`
- [ ] Version bumps committed, tags created `<pkg>-v<version>-nightly.<date>`
- [ ] GitHub Releases with VSIX attachments; VSIX installs

### Phase 3: Pre-release Promotion (After Adaptation)

- [ ] Wait ≥7 days
- [ ] Adapt `promote-prerelease.yml` for multi-extension (see [Options](#1-multi-extension-support))
- [ ] Dry-run: `gh workflow run promote-prerelease.yml -f dry-run=true`
- [ ] Run promotion; verify VSCE + OVSX pre-release published, tracking tags created

---

## Rollback Plan

If issues occur, revert with:

```bash
# Revert workflows
git checkout -- .github/workflows/nightly.yml \
                .github/workflows/nightly-extensions.yml \
                .github/workflows/promote-prerelease.yml \
                .github/workflows/package.yml \
                package.json

# Remove documentation (shared actions/scripts live in github-workflows, not locally)
rm .github/workflows/PRERELEASE-CI.md .github/workflows/MIGRATION-SUMMARY.md
```

---

## Support

1. [PRERELEASE-CI.md troubleshooting](./PRERELEASE-CI.md#troubleshooting)
2. [apex-language-support workflows](https://github.com/forcedotcom/apex-language-support/tree/main/.github/workflows)
3. File issue in salesforcedx-vscode repo

---

## Next Steps

1. Configure GitHub secrets
2. Test extension discovery: `npx tsx .github/scripts/index.ts ext-package-selector`
3. Dry-run: `gh workflow run nightly.yml -f dry-run=true -f extensions=changed`
4. Build: `gh workflow run nightly.yml -f extensions=changed`
5. Adapt `promote-prerelease.yml` for multi-extension (see [Known Issues](#1-multi-extension-support))
6. Wait ≥7 days, test pre-release promotion
7. Monitor marketplace

---

## Version History

| Date | Event |
|------|-------|
| 2026-07-15 | Migration committed (05aedfed9) |
| 2026-05-19 | Migration docs prepared |
| Source | apex-language-support @ main |
| Target | salesforcedx-vscode @ develop |

**Note:** apex-language-support continues evolving; periodic sync recommended for actions/scripts.
