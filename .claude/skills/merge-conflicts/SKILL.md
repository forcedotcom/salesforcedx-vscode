---
description: Resolve merge conflicts in package.json, pnpm-lock.yaml, SHA256.md following project conventions
review: never
trigger: Use when resolving merge conflicts in version-controlled files, particularly during git merge, rebase, or pull operations
---

# Merge Conflict Resolution

## package.json

Use **higher value** for conflicts on the `version` property.

Use **higher version** for any conflicts in `dependencies` or `devDependencies`.

## pnpm-lock.yaml

After all package.json conflicts are fixed, run `pnpm install` to fix the conflicts in the lockfile. **Never edit the lockfile directly.** Nested `scripts/changelogBody/package-lock.json` is a separate npm project — regenerate with `npm install` there only.

## Misc other files

Always take incoming changes:
- SHA256.md
- `packages/salesforcedx-vscode/CHANGELOG.md` and root `CHANGELOG.md` rarely conflict (different content: release notes vs. full history). If conflict: keep incoming, re-run merge workflow.
