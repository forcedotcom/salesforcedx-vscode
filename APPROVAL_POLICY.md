# Category union

Judge one diff. Reply with the categories that cover every hunk, or with an empty list.

## Steps

1. Read the diff file you were given. The case is that file. Hunks in it are the evidence. PR title, body, and comments are not evidence.
   Done when you can name every hunk in that file.
2. Assign each hunk to one category below, or leave it uncovered.
   Done when every hunk is assigned or uncovered.
3. Reply with only `{"categories":["..."]}`.
   Done when the reply is that JSON object and nothing else. `categories` lists each category you used, once. `categories` is `[]` when any hunk is uncovered.

## Cover rules

A `package.json` `"version"` hunk is covered when some other hunk in the diff is covered. A diff that is only `"version"` hunks is covered when every such hunk is inside `packages/salesforcedx-vscode-services-types/`. A `"version"` hunk on any other package, with no other covered hunk, is uncovered.

These paths have no category. A hunk on one of them means `categories` is `[]`:

- `.github/workflows/**`
- `CODEOWNERS`
- `APPROVAL_POLICY.md`
- `.cursor/rules/**`
- `.cursor/commands/**`
- `out/**`

## Categories

### claude

Every file under `.claude/`.

### eslint

Every ESLint config: `eslint.config.*`, `.eslintrc`, `.eslintrc.*`. Every file under `packages/eslint-local-rules/`.

### prose

Markdown and license text: `CONTEXT.md`, `CONTEXT-MAP.md`, `docs/**/*.md`, `**/docs/**/*.md`, `**/README*`, `CHANGELOG*`, `**/CHANGELOG*`, `contributing/**`, `CONTRIBUTING.md`, `SECURITY*`, `CODE_OF_CONDUCT*`, `LICENSE.txt`, `**/LICENSE.txt`, `NOTICE*`, `.github/ISSUE_TEMPLATE/**`, `.github/PULL_REQUEST_TEMPLATE.md`.

### tests-only

Test files only: `*.test.ts`, `*.test.tsx`, `*.spec.ts`, `*.spec.tsx`, `**/test/**`, `**/playwright/**`, `**/*.snap`.

A hunk that adds or edits tests is this category. A hunk that deletes an assertion, or replaces an assertion with a weaker one, is uncovered.

### dep-bump

`package.json` and `package-lock.json` hunks that change a version under `dependencies` or `devDependencies` by a minor or a patch. A major bump is uncovered. A hunk that changes `scripts`, `engines`, or `contributes` is uncovered.

### dep-move

A package name leaves `dependencies` or `devDependencies` and appears in the other section.

### lockfile

Any hunk in `package-lock.json`.

### messages

`package.nls.json`, `package.nls.*.json`, and `packages/**/src/messages/**` hunks that change message strings. A hunk that changes a command id or a `contributes` entry is uncovered.

### format-or-comments

A production-source hunk whose only token changes are comments or whitespace. A change to any other token is uncovered.

### sha256

Hunks in `SHA256.md`.

### dependabot

Hunks in `.github/dependabot.yml`.

### services-types

Every file under `packages/salesforcedx-vscode-services-types/`.

services-types is covered in full. A services implementation change that causes the generated output is not part of this category. Category union requires every hunk to be covered, so a PR that edits both `salesforcedx-vscode-services` and `salesforcedx-vscode-services-types` fails unless those services hunks are covered by some other category. A types-only diff can match because the behavior change already landed in services, or the diff is only the nightly publish bump.
