---
name: feature-branch
description: Create feature branches for all work. Use when creating branches, checking out, or pushing. Prevents accidental push to develop.
---

# Feature Branch

Never commit to `develop` or `main`.

## Do

```bash
git fetch origin develop
git checkout -b feature/W-XXXXX origin/develop --no-track
# ... work, commit ...
git push -u origin feature/W-XXXXX
```

## Don't

**Never** omit `--no-track` when branching from `origin/develop` — bare `git push` would push to `develop`.
