---
name: feature-branch
description: Create feature branches for all work. Use when creating branches, checking out, or pushing. Prevents accidental push to develop.
---

# Feature Branch

Never commit to `develop` or `main`.

## Do

Branch format: `sm/W-XXXXX-short-description` (owner prefix = `sm`, Shane McLaughlin).

```bash
git fetch origin develop
git checkout -b sm/W-XXXXX-short-description origin/develop --no-track
# ... work, commit ...
git push -u origin sm/W-XXXXX-short-description
```

## Don't

**Never** omit `--no-track` when branching from `origin/develop` — bare `git push` would push to `develop`.
