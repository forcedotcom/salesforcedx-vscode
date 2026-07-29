---
name: feature-branch
description: Create feature branches for all work. Use when creating branches, checking out, or pushing. Prevents accidental pushes to protected branches.
---

# Feature Branch

Never commit to `develop` or `main`.

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
