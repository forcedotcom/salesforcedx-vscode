---
name: feature-branch
description: Create feature branches for all work. Use when creating branches, checking out, or pushing. Prevents accidental push to develop.
---

# Feature Branch

All work must be on feature branches. Never commit directly to develop or main.

## Do

```bash
git fetch origin develop
git checkout develop
git pull
git checkout -b feature/W-XXXXX
# ... work, commit ...
git push -u origin feature/W-XXXXX
```

Or, branch from remote without tracking it:

```bash
git fetch origin develop
git checkout -b feature/W-XXXXX origin/develop --no-track
```

## Don't

**Never** `git checkout -b feature/W-XXXXX origin/develop` without `--no-track`.

That sets the new branch to track `origin/develop`. A bare `git push` would then push to develop instead of creating a remote feature branch.

## Summary

- All work on feature branches
- Use `--no-track` when branching from `origin/<base>`, or branch from local `<base>` after pull
- Always push with explicit branch: `git push -u origin feature/W-XXXXX`
