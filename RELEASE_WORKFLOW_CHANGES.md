# Release Workflow Implementation - Phase 1 Complete

## What Was Implemented

### ✅ New Workflow Created
**File:** `.github/workflows/buildReleaseFromPrerelease.yml`

**Purpose:** Build release VSIXs directly from promoted prerelease tags

**Features:**
- Auto-detects latest nightly tag OR accepts manual tag input
- Auto-calculates release version (minor bump) OR accepts manual version
- Updates all package.json versions
- Builds VSIXs with final release version
- Generates SHA256.md checksums
- Creates GitHub pre-release with all artifacts
- No release branch needed!

**How to Use:**
```bash
# Option 1: Auto-detect latest nightly (most common)
# Go to Actions → Build Release from Prerelease → Run workflow
# Leave both inputs empty

# Option 2: Specify exact prerelease tag
# prereleaseTag: v67.11.1-nightly.develop.20260812
# releaseVersion: (leave empty to auto-calculate)

# Option 3: Override version
# prereleaseTag: (leave empty to auto-detect)
# releaseVersion: 67.12.0
```

### ✅ Old Workflow Deprecated
**File:** `.github/workflows/createReleaseBranch.yml`

**Changes:**
- Added deprecation notice at top of file
- Disabled Monday cron schedule (commented out)
- Marked as "DEPRECATED" in workflow name
- Points to new workflow in comments

**Status:** Will be removed after 2-3 successful releases with new workflow

### ✅ Existing Workflows Verified
**No changes needed to:**
- `.github/workflows/publishVSCode.yml` - Already accepts version input ✅
- `.github/workflows/nightly.yml` - Already has workflow_dispatch ✅
- `.github/workflows/promote-prerelease.yml` - Already has workflow_dispatch ✅

## Investigation Results

### Prerelease Tag Format
**Pattern:** `v{version}-nightly.develop.{YYYYMMDD}`

**Example:** `v67.11.1-nightly.develop.20260812`

**How promote works:** The `promote-prerelease.yml` workflow checks nightly tags ≥7 days old with passing CI. Currently uses these tags directly (no special "promoted" tag created).

### How publishVSCode.yml Works
**Trigger options:**
1. Automatic: When a GitHub release is marked as "released" (not pre-release)
2. Manual: workflow_dispatch with version input

**Process:**
1. Takes version input (e.g., "67.12.0")
2. Downloads VSIXs from GitHub release tag `v{version}`
3. Validates VSIX files
4. Opens Change Tracking Case (CTC)
5. Publishes to marketplace with approval gate
6. Closes CTC

**Perfect for our workflow!** Just trigger it after testing pre-release.

## New Release Process

### Happy Path (Normal Release)

**Monday: Create Release**
```bash
1. Go to Actions → "Build Release from Prerelease"
2. Click "Run workflow"
3. Leave inputs empty (auto-detect Wednesday's promoted tag)
4. Wait ~10-15 minutes for build
```

**Output:** GitHub pre-release with tag like `v67.12.0`

**Tuesday-Thursday: Test**
```bash
1. Go to Releases → find v67.12.0 (marked as Pre-release)
2. Download VSIX files
3. Install locally: find . -name "*.vsix" -exec code --install-extension {} \;
4. Run manual QA tests
```

**Friday: Publish to Marketplace** (if tests pass)
```bash
1. Go to Actions → "Publish in Microsoft Marketplace"
2. Click "Run workflow"
3. Enter version: 67.12.0
4. Approve in the "publish" environment gate
5. Wait for marketplace publish
```

**Done!** Release v67.12.0 is in marketplace with exact VSIXs that were tested.

### Unhappy Path (Test Failures)

**If testing reveals bugs:**

```bash
1. Fix bugs in develop branch
2. Go to Actions → "Nightly Release"
3. Click "Run workflow"
   - branch: develop
   - Leave other inputs empty
4. Wait for nightly build
5. Go to Actions → "Promote Nightly to Pre-release"
6. Click "Run workflow" (promotes the nightly you just built)
7. Go to Actions → "Build Release from Prerelease"
8. Click "Run workflow"
   - prereleaseTag: (leave empty to auto-detect)
   - releaseVersion: 67.12.1 (bump version!)
9. Repeat testing with v67.12.1
```

### Emergency Path (Urgent Fix After Wednesday)

**If critical fix needed between Wednesday promotion and Monday release:**

```bash
1. Merge urgent fix to develop
2. Trigger "Nightly Release" workflow (creates immediate prerelease)
3. Trigger "Promote Nightly to Pre-release" workflow
4. Continue with normal "Build Release from Prerelease" workflow
```

**Timeline:** Same day! No waiting for next Wednesday.

## Testing Plan

### Phase 1: Dry Run (This Week)
- [ ] Create mock nightly tag: `git tag v67.11.99-nightly.develop.20260815 && git push origin v67.11.99-nightly.develop.20260815`
- [ ] Trigger buildReleaseFromPrerelease.yml workflow
- [ ] Verify GitHub pre-release created
- [ ] Verify VSIXs downloadable
- [ ] Test version calculation logic
- [ ] Delete test release: `gh release delete v67.12.0 && git tag -d v67.12.0 && git push origin :v67.12.0`

### Phase 2: Real Release (Next Release Cycle)
- [ ] Use buildReleaseFromPrerelease.yml for next scheduled release
- [ ] Download and test VSIXs from pre-release
- [ ] Publish to marketplace using publishVSCode.yml
- [ ] Verify SHA256 checksums match
- [ ] Collect feedback from release engineer

### Phase 3: Validate Failure Path
- [ ] Simulate test failure
- [ ] Create immediate prerelease
- [ ] Bump version and retry
- [ ] Verify complete flow works

## Benefits Achieved

### ✅ Simplicity
- **ONE new workflow** (vs. original plan of multiple workflows + scripts)
- No release branches to manage
- No custom scripts needed
- Reuses ALL existing infrastructure

### ✅ Safety
- Test exact VSIXs that go to marketplace (byte-identical)
- SHA256 verification built-in
- No rebuild between test and publish

### ✅ Speed
- Eliminate release branch creation step
- Fast iteration on test failures (immediate prerelease)
- No merge conflicts from release branches

### ✅ Flexibility
- Can create immediate prerelease anytime (emergency fixes)
- Manual override for tag and version (edge cases)
- Roll back to old workflow if needed (it's just deprecated, not deleted)

## Next Steps

### Immediate (This Week)
1. ✅ Create buildReleaseFromPrerelease.yml - **DONE**
2. ✅ Deprecate createReleaseBranch.yml - **DONE**
3. ✅ Verify existing workflows work - **DONE**
4. ⏳ Update documentation (contributing/publishing.md) - **IN PROGRESS**
5. ⏳ Test with mock tag

### Next Release Cycle
1. Use new workflow for real release
2. Collect feedback
3. Iterate if needed

### After 2-3 Successful Releases
1. Remove createReleaseBranch.yml completely
2. Update all documentation references
3. Celebrate simplified workflow! 🎉

## Files Changed

```
.github/workflows/
├── buildReleaseFromPrerelease.yml          NEW - Main release workflow
└── createReleaseBranch.yml                 MODIFIED - Deprecated, cron disabled

Documentation updates:
└── contributing/publishing.md              IN PROGRESS - Doc agent working
```

## Rollback Plan

If new workflow has issues:

```bash
1. Re-enable Monday cron in createReleaseBranch.yml
   - Uncomment schedule section (lines ~7-8)
   
2. Use old workflow for emergency release
   - Trigger createReleaseBranch.yml manually
   
3. Debug new workflow offline
   - Test with mock tags
   - Fix issues
   
4. Retry new workflow next cycle
```

The old workflow remains functional (just deprecated), so zero risk of breaking releases.

## Questions or Issues?

Contact: @madhur.shrivastava or check the [implementation plan](/.claude/plans/see-current-state-of-expressive-prism.md)
