# package.json

Use higher value for conflicts on the `version` property

User higher version for any conflicts in dependencies or devDependencies.

## pnpm-lock.yaml

After all package.json conflicts are fixed, run `pnpm install` to fix the conflicts in the lockfile. Never edit the lockfile directly. Nested `scripts/changelogBody/package-lock.json` is a separate npm project — regenerate with `npm install` there only.

## Misc other files

- CHANGELOG.md
- SHA256.md

Always take the incoming changes
