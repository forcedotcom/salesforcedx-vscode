# Patch Release Skill

**User-invocable only.** Run emergency patch releases for critical hotfixes.

**Invoke:** `/patch-release` or user explicitly requests patch release workflow.

**DO NOT use during `/release`** — this skill is for emergency hotfixes only.

## When to use

- Security vulnerabilities requiring immediate fix
- Critical production bugs affecting customers
- Showstopper issues that cannot wait for next stable release

## Steps

### 1. Create release-base branch

```sh
gh workflow run create-patch-release-branch.yml -f baseVersion="67.12.0" --repo forcedotcom/salesforcedx-vscode
```

Creates `release-base/v67.12.x` from stable tag; copies latest version helpers from develop.

### 2. Check out branch locally

```sh
git fetch origin
git checkout release-base/v67.12.x
```

### 3. Apply fixes

Make code changes, commit with conventional messages (fix:, feat:, etc.), push to branch:

```sh
git commit -m "fix: <message>"
git push origin release-base/v67.12.x
```

### 4. Build patch release

```sh
gh workflow run build-patch-release.yml -f releaseBranch="release-base/v67.12.x" --repo forcedotcom/salesforcedx-vscode
```

Auto-calculates patch version (v67.12.0 → v67.12.1), tags exact commit from branch HEAD, builds VSIXs.

### 5. Test VSIX files

Download and install locally for testing:

```sh
gh release download v67.12.1 --dir ~/Downloads/v67.12.1 --pattern '*.vsix' --repo forcedotcom/salesforcedx-vscode
find ~/Downloads/v67.12.1 -type f -name "*.vsix" -exec code --install-extension {} \;
```

Run manual QA tests. See [docs/release-testing-guide.md](../../../docs/release-testing-guide.md) for testing checklist.

### 6. Publish to marketplace

If tests pass:

```sh
gh workflow run publishVSCode.yml -f releaseVersion="67.12.1" --repo forcedotcom/salesforcedx-vscode
```

### 7. Cherry-pick fixes to develop

Merge functional fixes back to develop (NOT version bumps):

```sh
git checkout develop && git pull origin develop
git cherry-pick <commit-sha>  # functional fixes only, NOT "chore: bump versions"
git push origin develop
```

See [docs/release-testing-guide.md](../../../docs/release-testing-guide.md) for detailed cherry-pick workflow.

### 8. Cleanup (after publishing)

Delete the release-base branch:

```sh
git push origin --delete release-base/v67.12.x
```

## Multiple patches on same base

Reuse the same `release-base/v67.12.x` branch for multiple patches:

1. Make additional fixes on the branch
2. Run `build-patch-release.yml` again (auto-increments to v67.12.2, v67.12.3, etc.)
3. Test and publish each patch
4. Cherry-pick all functional fixes to develop
5. Delete branch after final patch

## Emergency Pre-release Hotfix (Marketplace in ~5 min)

For **immediate** marketplace hotfix as pre-release (bypasses stable testing):

### Step 1: Build emergency pre-release VSIXs

```sh
# From hotfix branch
gh workflow run build-release.yml \
  -f publishAsPrerelease=true \
  -f startFromRef="hotfix/security-fix" \
  --repo forcedotcom/salesforcedx-vscode

# From specific commit
gh workflow run build-release.yml \
  -f publishAsPrerelease=true \
  -f startFromRef="abc123def456" \
  --repo forcedotcom/salesforcedx-vscode
```

Creates GitHub pre-release with VSIXs. No version bump — tags source ref directly as nightly format.

### Step 2: Publish to marketplace as pre-release

```sh
gh workflow run promote-nightly-to-prerelease.yml \
  -f releaseTag="v67.13.7-nightly.develop.20260820" \
  --repo forcedotcom/salesforcedx-vscode
```

Publishes VSIXs to marketplace (Microsoft + Open VSX) as **pre-release**.

**Timeline:** ~3 min build + ~2 min promote = **~5 min total to marketplace**.

## Alternative: Formal Version from Arbitrary Ref

For time-critical fixes requiring proper version tracking (not nightly format):

```sh
# Build from hotfix branch with version bump
gh workflow run build-release.yml \
  -f startFromRef="hotfix/security-fix" \
  -f releaseVersion="67.12.1" \
  --repo forcedotcom/salesforcedx-vscode

# Build from specific commit with version bump
gh workflow run build-release.yml \
  -f startFromRef="abc123def456" \
  -f releaseVersion="67.12.1" \
  --repo forcedotcom/salesforcedx-vscode
```

Creates isolated `release-staging/v67.12.1` branch with version bump. Test and publish as stable release.

## References

- Testing guide: [docs/release-testing-guide.md](../../../docs/release-testing-guide.md)
- Standard release: [../release/SKILL.md](../release/SKILL.md)
- Publishing details: [contributing/publishing.md](../../../contributing/publishing.md)
