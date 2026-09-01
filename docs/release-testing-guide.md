# Release Testing Guide

Guide for testing pre-release builds before publishing to marketplace.

## Overview

This guide covers testing and publishing for:
- **Stable releases** (built by `build-release.yml`)
- **Patch releases** (built by `build-and-release-patch-branch.yml`)
- **Emergency pre-releases** (built by `build-release.yml` with `publishAsPrerelease=true`)

After any build workflow creates a pre-release, follow these steps to test and publish.

## Testing Checklist

### 1. Download VSIX Files

```bash
# Replace v67.12.0 with your release tag
gh release download v67.12.0 --dir ~/Downloads/v67.12.0 --pattern '*.vsix' --repo forcedotcom/salesforcedx-vscode
```

### 2. Install Extensions Locally

```bash
cd ~/Downloads/v67.12.0
find . -name "*.vsix" -exec code --install-extension {} \;
```

### 3. Run Manual QA Tests

- Test core functionality (Apex, LWC, SOQL, etc.)
- Verify bug fixes from this release
- Check for regressions in key workflows
- Test on both Mac and Windows if possible

### 4. Decision Point

**If tests PASS:**
- Proceed to "Publishing to Marketplace" section below

**If tests FAIL:**
- Create immediate hotfix
- Build new pre-release with bumped version
- Retry testing

## Publishing to Marketplace

### Stable Release

```bash
# Trigger marketplace publish workflow
gh workflow run publishVSCode.yml \
  -f version="v67.12.0" \
  --repo forcedotcom/salesforcedx-vscode
```

Monitor the workflow at: https://github.com/forcedotcom/salesforcedx-vscode/actions/workflows/publishVSCode.yml

### Pre-release (Emergency Hotfix)

```bash
# Promote to marketplace as pre-release
gh workflow run promote-nightly-to-prerelease.yml \
  -f releaseTag="v67.12.0" \
  --repo forcedotcom/salesforcedx-vscode
```

## Post-Publishing Cleanup

### Delete Isolated Release Branch

Stable releases are built on `release-staging/v{version}` branches that should NOT be merged to develop:

```bash
# Delete the staging branch after publishing
git push origin --delete release-staging/v67.12.0
```

**Important:** Only cherry-pick functional fixes to develop, NOT the version-bump commit.

### Cherry-pick Functional Fixes

If the release included functional fixes (not just version bumps), cherry-pick them to develop:

```bash
git checkout develop && git pull origin develop
git cherry-pick <commit-sha>  # functional fixes only
git push origin develop
```

## Patch Release Workflow

For hotfixes on already-published stable releases:

### 1. Build Patch Release

```bash
# From a patch branch (e.g., release/v67.x)
gh workflow run build-and-release-patch-branch.yml \
  -f branch="release/v67.x" \
  --repo forcedotcom/salesforcedx-vscode
```

### 2. Test VSIX Files

Follow the testing checklist above.

### 3. Publish to Marketplace

```bash
gh workflow run publishVSCode.yml \
  -f version="v67.12.1" \
  --repo forcedotcom/salesforcedx-vscode
```

### 4. Cherry-pick to develop

After publishing, cherry-pick **ONLY functional fixes** back to develop:

```bash
git checkout develop && git pull origin develop

# Cherry-pick only functional fixes (NOT version-bump commits)
git log v67.12.0..v67.12.1 --pretty=format:"%H %s" | grep -v "chore: bump versions"
# For each commit hash, cherry-pick individually:
git cherry-pick <commit-sha>

git push origin develop
```

**Important:** Do NOT cherry-pick the version-bump commit (e.g., "chore: bump versions").

## Emergency Pre-release Workflow

For urgent hotfixes that need immediate marketplace publication as pre-release:

### 1. Build Emergency Pre-release

```bash
# From hotfix branch or specific commit
gh workflow run build-release.yml \
  -f publishAsPrerelease=true \
  -f startFromRef="hotfix/security-fix" \
  --repo forcedotcom/salesforcedx-vscode
```

### 2. Test VSIX Files

Follow the testing checklist above.

### 3. Publish to Marketplace as Pre-release

```bash
gh workflow run promote-nightly-to-prerelease.yml \
  -f releaseTag="v67.12.0" \
  --repo forcedotcom/salesforcedx-vscode
```

## Troubleshooting

### VSIX Installation Fails

- Check VS Code version compatibility
- Try uninstalling old version first: `code --uninstall-extension salesforce.salesforcedx-vscode`
- Check extension logs: View → Output → Salesforce CLI

### Tests Reveal Critical Bug

1. **Stop the release** - Do not publish to marketplace
2. Create hotfix branch
3. Build new pre-release with bumped version
4. Retest completely

### Workflow Fails

Check common issues:
- Secrets configured correctly (VSCE_PAT, IDEE_GH_TOKEN)
- Release tag format correct (v{major}.{minor}.{patch})
- No naming conflicts with existing releases

## Reference

- Full release workflow: [SKILL.md](../.claude/skills/release/SKILL.md)
- Publishing details: [publishing.md](../contributing/publishing.md)
