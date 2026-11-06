---
name: feature-branch
description: Create feature branches for all work. Use when creating branches, checking out, or pushing. Prevents accidental pushes to protected branches.
review: never
---

# Feature Branch

Never commit to `develop` or `main`.

## Stack detection

Before pushing, rebasing, or creating a PR, detect whether the current branch belongs to a GitHub stack:

```bash
gh pr view --json headRefName,baseRefName,url 2>/dev/null || true
git config --get "branch.$(git branch --show-current).github-pr-base-branch"
gh stack view
```

A branch is stacked when its existing PR `baseRefName`, or its stored `github-pr-base-branch`, is neither `develop` nor `main`.

- Stacked branch: use `gh stack push` to publish changes, `gh stack sync` before integrating remote updates, and `gh stack rebase` for stack-wide rebases.
- Non-stacked branch: use `git push -u origin <branch>`.
- Do not use `git pull` or a single-branch rebase to resolve remote divergence on a stacked branch before checking `gh stack sync` or `gh stack rebase`.

## Branch

Resolve `ownerPrefix` via [gus-cli runner identity](../gus-cli/SKILL.md#runner-identity).

Format: `<ownerPrefix>/W-XXXXX-short-description`.

Example for Shane McLaughlin (`ownerPrefix = sm`):

```bash
git fetch origin develop
git checkout -b sm/W-XXXXX-short-description origin/develop --no-track
# ... work, commit ...
git push -u origin sm/W-XXXXX-short-description
```

Never omit `--no-track` off `origin/develop` — bare `git push` could push `develop`.
