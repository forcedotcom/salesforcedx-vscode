# Temporary Commits to Drop Before Merging to Main

⚠️ **CRITICAL:** These commits are for ci-testing only and MUST be dropped before pushing to the main `salesforcedx-vscode` repository.

## Commits to Drop:

### 1. CI Complete Dummy Check (commit: `1419966dc`)
**File:** `.github/workflows/ci-complete-dummy.yml`
**Reason:** Temporary workaround to satisfy promote-prerelease quality gate
**Why it exists:** ci-testing repo doesn't have "CI Complete" check configured
**Proper fix:** Configure upstream workflow with actual CI check names (see TODO-UPSTREAM-GATE-CHECK.md)

## How to Drop These Commits:

When ready to push to main salesforcedx-vscode repo:

```bash
# Option 1: Interactive rebase (recommended)
git checkout feat/simplified-release-workflow
git rebase -i develop

# In the editor, mark commit 1419966dc as "drop" or delete the line
# Save and close

# Option 2: Revert the specific commit
git revert 1419966dc

# Option 3: Cherry-pick without the temp commit
git checkout develop
git cherry-pick <first-commit>..<commit-before-1419966dc>
git cherry-pick <commit-after-1419966dc>..HEAD
```

## Verification:

After dropping, verify the file doesn't exist:
```bash
ls .github/workflows/ci-complete-dummy.yml
# Should return: No such file or directory
```
