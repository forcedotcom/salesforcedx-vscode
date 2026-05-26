---
description: Resolve merge conflicts in package.json, package-lock.json, CHANGELOG.md, and SHA256.md following project conventions
trigger: Use when resolving merge conflicts in version-controlled files, particularly during git merge, rebase, or pull operations
---

# Merge Conflict Resolution

## package.json

Use **higher value** for conflicts on the `version` property.

Use **higher version** for any conflicts in `dependencies` or `devDependencies`.

## package-lock.json

After all package.json conflicts are fixed, run `npm install` to fix the conflicts in the lockfile. **Never edit the lockfile directly.**

## Misc other files

For these files, **always take the incoming changes**:
- CHANGELOG.md
- SHA256.md
