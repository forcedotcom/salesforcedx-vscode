# CI Testing Plan - Simplified Release Workflow

Test plan for validating release workflow changes on `salesforcedx-vscode-ci-testing` repo.

**Important:** ci-testing repo has no marketplace secrets → workflows will build VSIXs but skip actual publishing.

---

## Pre-Test Setup

### 1. Create Test Nightly Tags

```sh
# Create a nightly tag from current develop
CURRENT_VERSION="67.12.0"
TODAY=$(date -u +%Y%m%d)
NIGHTLY_TAG="v${CURRENT_VERSION}-nightly.develop.${TODAY}"

git tag -a "$NIGHTLY_TAG" -m "Test nightly for CI testing"
git push ci-testing "$NIGHTLY_TAG"
```

### 2. Create Marketplace Tracking Tag

```sh
# Simulate Wednesday promotion - create tracking tag
TRACKING_TAG="marketplace-prerelease-salesforcedx-vscode-v${CURRENT_VERSION}"

git tag -a "$TRACKING_TAG" "$NIGHTLY_TAG" -m "Test tracking tag for Mon detection"
git push ci-testing "$TRACKING_TAG"
```

### 3. Create Old Stable Tag for Patch Testing

```sh
# Create an older stable version for patch testing
OLD_VERSION="67.11.0"
git tag -a "v${OLD_VERSION}" -m "Test stable version for patch"
git push ci-testing "v${OLD_VERSION}"
```

---

## Test Suite

### Test 1: Auto-Detection of Promoted Pre-release

**Goal:** Verify `build-release.yml` auto-detects latest `marketplace-prerelease-*` tracking tag

**Steps:**
1. Go to Actions → `build-release.yml`
2. Click "Run workflow"
3. Leave all inputs empty (test auto-detection)
4. Run workflow

**Expected Results:**
- ✅ Workflow detects tracking tag `marketplace-prerelease-salesforcedx-vscode-v67.12.0`
- ✅ Extracts version `67.12.0` from tracking tag
- ✅ Finds matching nightly tag `v67.12.0-nightly.develop.YYYYMMDD`
- ✅ Creates `release-staging/v67.13.0` branch (minor bump)
- ✅ Updates all package.json versions to `67.13.0`
- ✅ Creates release tag `v67.13.0`
- ✅ Builds VSIX files
- ✅ Creates GitHub release with VSIXs attached
- ✅ Release notes include branch cleanup instructions

**Validation:**
```sh
# Check branch created
git fetch ci-testing
git branch -r | grep release-staging/v67.13.0

# Check tag created
git ls-remote --tags ci-testing | grep v67.13.0

# Check release created
gh release view v67.13.0 --repo forcedotcom/salesforcedx-vscode-ci-testing

# Download VSIXs and verify
gh release download v67.13.0 --pattern "*.vsix" --repo forcedotcom/salesforcedx-vscode-ci-testing
```

---

### Test 2: Emergency Pre-release from Hotfix Branch

**Goal:** Verify emergency pre-release mode builds from arbitrary ref without version bump

**Setup:**
```sh
# Create hotfix branch
git checkout -b hotfix/test-emergency-fix
echo "# Test fix" >> README.md
git commit -am "fix: emergency test fix"
git push ci-testing hotfix/test-emergency-fix
```

**Steps:**
1. Go to Actions → `build-release.yml`
2. Click "Run workflow"
3. Set inputs:
   - `publishAsPrerelease`: `true`
   - `startFromRef`: `hotfix/test-emergency-fix`
4. Run workflow

**Expected Results:**
- ✅ Workflow uses hotfix branch directly (no version bump)
- ✅ Creates nightly-format tag: `v67.13.1-nightly.develop.YYYYMMDD` (uses current version + patch)
- ✅ Tags the exact commit from hotfix branch
- ✅ Builds VSIX files from that commit
- ✅ Creates "Emergency Pre-release" GitHub release
- ✅ Release marked as pre-release (not stable)
- ✅ No `release-staging` branch created

**Validation:**
```sh
# Check emergency tag points to hotfix commit
HOTFIX_COMMIT=$(git rev-parse hotfix/test-emergency-fix)
EMERGENCY_TAG_COMMIT=$(git ls-remote ci-testing refs/tags/v67.13.1-nightly.develop.* | head -1 | cut -f1)
test "$HOTFIX_COMMIT" = "$EMERGENCY_TAG_COMMIT" && echo "✅ Tag points to hotfix" || echo "❌ Tag mismatch"

# Verify no staging branch
git ls-remote ci-testing | grep release-staging && echo "❌ Staging branch exists" || echo "✅ No staging branch"
```

---

### Test 3: Promote Nightly to Pre-release

**Goal:** Verify 3-stage promotion workflow creates tracking tag

**Steps:**
1. Go to Actions → `promote-prerelease.yml`
2. Click "Run workflow"
3. Leave inputs empty (auto-select latest nightly)
4. Run workflow

**Expected Results:**
- ✅ Stage 1 (find-nightly): Finds nightly ≥7 days old
- ✅ Stage 2 (gate-check): Verifies all CI checks passed on nightly commit
- ✅ Stage 3 (promote): Creates tracking tag `marketplace-prerelease-salesforcedx-vscode-vX.Y.Z` (skipped on ci-testing due to no secrets)
- ✅ Workflow completes successfully even without publish secrets

**Validation:**
```sh
# Check tracking tag created
git ls-remote --tags ci-testing | grep marketplace-prerelease-salesforcedx-vscode
```

---

### Test 4: Create Patch Release Branch

**Goal:** Verify patch branch creation auto-copies version scripts from develop

**Steps:**
1. Go to Actions → `create-patch-release-branch.yml`
2. Click "Run workflow"
3. Set `baseVersion`: `67.11.0`
4. Run workflow

**Expected Results:**
- ✅ Creates `release-base/v67.11.x` from tag `v67.11.0`
- ✅ Restores `scripts/calculate-release-version.js` from develop
- ✅ Restores `scripts/update-release-versions.js` from develop
- ✅ Verifies script integrity via checksums
- ✅ Commits script updates if needed

**Validation:**
```sh
# Check branch created
git fetch ci-testing
git checkout -b local-patch ci-testing/release-base/v67.11.x

# Verify scripts exist
ls -la scripts/calculate-release-version.js
ls -la scripts/update-release-versions.js

# Check for script update commit
git log --oneline -5 | grep "chore: restore version helper scripts from develop"
```

---

### Test 5: Build Patch Release

**Goal:** Verify patch version auto-calculation and stable tag filtering

**Pre-requisite:** Test 4 completed (release-base branch exists)

**Setup:**
```sh
# Push a fix to the patch branch
git checkout ci-testing/release-base/v67.11.x
echo "# Patch fix" >> README.md
git commit -am "fix: test patch fix"
git push ci-testing HEAD:release-base/v67.11.x
```

**Steps:**
1. Go to Actions → `build-patch-release.yml`
2. Click "Run workflow"
3. Set `releaseBranch`: `release-base/v67.11.x`
4. Run workflow

**Expected Results:**
- ✅ Filters existing tags for stable only (excludes `-nightly`, `-beta`, etc.)
- ✅ Finds latest stable tag `v67.11.0`
- ✅ Calculates next patch: `v67.11.1`
- ✅ Updates versions in all package.json files
- ✅ Creates tag `v67.11.1` with `--target` pointing to exact commit
- ✅ Builds VSIX files
- ✅ Creates GitHub release with cherry-pick instructions

**Validation:**
```sh
# Check tag created and points to correct commit
git fetch ci-testing --tags
PATCH_TAG_COMMIT=$(git rev-parse v67.11.1)
BRANCH_HEAD=$(git rev-parse ci-testing/release-base/v67.11.x)
test "$PATCH_TAG_COMMIT" = "$BRANCH_HEAD" && echo "✅ Tag points to branch head" || echo "❌ Tag mismatch"

# Check release notes
gh release view v67.11.1 --repo forcedotcom/salesforcedx-vscode-ci-testing | grep "cherry-pick"
```

---

### Test 6: Version Calculator - Prerelease Format Support

**Goal:** Verify version scripts accept prerelease versions like `67.12.0-beta.1`

**Steps:**
```sh
cd /Users/madhur.shrivastava/salesforcedx-vscode

# Test prerelease version parsing
node scripts/calculate-release-version.js --prerelease-tag="v67.12.0-beta.1-nightly.develop.20260820"

# Test version bounds
node scripts/calculate-release-version.js --prerelease-tag="v9999.9999.9999-nightly.develop.20260820"
```

**Expected Results:**
- ✅ Accepts `67.12.0-beta.1` format
- ✅ Bumps to `67.13.0` (strips prerelease suffix, bumps minor)
- ✅ Rejects version > 9999 with clear error

---

### Test 7: Prerelease Filtering

**Goal:** Verify publishVSCode.yml correctly filters out nightly/prerelease tags

**Note:** This workflow will fail on ci-testing due to missing publish secrets, but we can check the filtering logic.

**Steps:**
1. Create a nightly tag manually on ci-testing repo: `v67.14.0-nightly.develop.20260831`
2. Create a GitHub release for this tag marked as pre-release
3. Observe that `publishVSCode.yml` does NOT trigger automatically

**Expected Results:**
- ✅ Workflow does not run for nightly tags (filtered by `if` condition on line 31)
- ✅ Only stable tags without `-nightly` suffix trigger the workflow
- ✅ Release type detection (`CBW_RELEASE_TYPE`) distinguishes between `patch` and `minor` based on version comparison

---

### Test 8: Isolated Branch Cleanup

**Goal:** Verify release-staging branch gets documented for cleanup

**Pre-requisite:** Test 1 completed (release-staging branch created)

**Steps:**
1. Check release notes from Test 1
2. Follow cleanup instructions

**Expected Results:**
- ✅ Release notes contain: "Delete `release-staging/v67.13.0` after publish"
- ✅ Branch deletion command works:
```sh
git push ci-testing --delete release-staging/v67.13.0
```

---

### Test 9: Multiple Patch Releases

**Goal:** Verify patch workflow correctly increments for multiple patches

**Pre-requisite:** Test 5 completed (v67.11.1 exists)

**Setup:**
```sh
# Push another fix
git checkout ci-testing/release-base/v67.11.x
echo "# Another fix" >> README.md
git commit -am "fix: second patch fix"
git push ci-testing HEAD:release-base/v67.11.x
```

**Steps:**
1. Run `build-patch-release.yml` again with same branch
2. Check version increments to `v67.11.2`

**Expected Results:**
- ✅ Detects `v67.11.1` as latest
- ✅ Calculates next patch: `v67.11.2`
- ✅ Creates new release

---

### Test 10: Nightly Format Validation

**Goal:** Verify workflows reject invalid tag formats

**Steps:**
1. Try to trigger `build-release.yml` with invalid prereleaseTag:
   - `prereleaseTag`: `v67.12.0-invalid-format`
2. Run workflow

**Expected Results:**
- ✅ Workflow fails with clear error about tag format
- ✅ Error message shows expected format: `v{major}.{minor}.{patch}-nightly.develop.{YYYYMMDD}`

---

## Summary Checklist

After running all tests, verify:

- [ ] Auto-detection finds correct tracking tag
- [ ] Emergency pre-release skips version bump
- [ ] Promotion creates tracking tags
- [ ] Patch branches get version scripts
- [ ] Patch versions increment correctly
- [ ] Prerelease versions parse correctly
- [ ] Prerelease filtering prevents nightly tag publishing
- [ ] Isolated branches documented for cleanup
- [ ] Multiple patches work sequentially
- [ ] Invalid formats rejected with clear errors

---

## Cleanup

After testing, clean up ci-testing repo:

```sh
# Delete test tags
git push ci-testing --delete v67.12.0-nightly.develop.*
git push ci-testing --delete v67.13.0
git push ci-testing --delete v67.13.1-nightly.develop.*
git push ci-testing --delete v67.11.0
git push ci-testing --delete v67.11.1
git push ci-testing --delete v67.11.2
git push ci-testing --delete marketplace-prerelease-salesforcedx-vscode-v67.12.0

# Delete test branches
git push ci-testing --delete release-staging/v67.13.0
git push ci-testing --delete release-base/v67.11.x
git push ci-testing --delete hotfix/test-emergency-fix

# Delete test releases
gh release delete v67.13.0 --repo forcedotcom/salesforcedx-vscode-ci-testing --yes
gh release delete v67.13.1-nightly.develop.* --repo forcedotcom/salesforcedx-vscode-ci-testing --yes
gh release delete v67.11.1 --repo forcedotcom/salesforcedx-vscode-ci-testing --yes
gh release delete v67.11.2 --repo forcedotcom/salesforcedx-vscode-ci-testing --yes
```
