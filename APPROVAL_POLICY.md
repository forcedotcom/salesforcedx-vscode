# Category union

Approve only when the category union covers every hunk in the original diff.

## Deterministic classification

`scripts/categoryApprove.mts` assigns the path-only categories below, including both paths of a rename. These assignments cannot be changed by the model. Fully covered diffs do not invoke OpenCode. Mixed diffs send only the remaining files' hunks for content review; any uncovered hunk rejects the whole diff.

These paths have no category; changing one rejects the whole diff:

- `.github/workflows/**`
- `CODEOWNERS`
- `APPROVAL_POLICY.md`
- `out/**`

Non-Markdown files under root `plans/` are also rejected, even if another category could match their names. `.git2gus/config.json` is covered only by its special rule below.

### claude

Every file under `.claude/`.

### cursor

Every file under `.cursor/`.

### eslint

Every ESLint config: `eslint.config.*`, `.eslintrc`, `.eslintrc.*`. Every file under `packages/eslint-local-rules/`.

### vscode

Every file under `.vscode/`.

### metadata-types

`packages/salesforcedx-vscode-core/metadata_types_map_scraped.json` and `packages/salesforcedx-vscode-core/resources/salesforce_metadata_api_common.xsd`.

### effect-diagnostics

`config/effect-diagnostics.json`.

### git2gus-config

Only a modified `.git2gus/config.json`, with no other changed files. The only edit is a newer, positive, safe-integer `defaultBuild` number in `offcore.tooling.<number>`; the rest of the JSON must be unchanged and valid. This category is checked against the base and head file contents by `scripts/categoryApprove.mts`. Other config edits, additions, deletions, or mixed diffs are uncovered.

### changelog-constants

`scripts/change-log-constants.*`.

### plans

Only Markdown (`.md`) files under `plans/` at the repo root, including subdirectories.

### prose

Markdown and license text: `CONTEXT.md`, `CONTEXT-MAP.md`, `docs/**/*.md`, `**/docs/**/*.md`, `**/README*`, `CHANGELOG*`, `**/CHANGELOG*`, `contributing/**`, `CONTRIBUTING.md`, `SECURITY*`, `CODE_OF_CONDUCT*`, `LICENSE.txt`, `**/LICENSE.txt`, `NOTICE*`, `.github/ISSUE_TEMPLATE/**`, `.github/PULL_REQUEST_TEMPLATE.md`.

### lockfile

Any hunk in `package-lock.json`.

### sha256

Hunks in `SHA256.md`.

### dependabot

Hunks in `.github/dependabot.yml`.

### services-types

Every file under `packages/salesforcedx-vscode-services-types/`.

services-types is covered in full. A services implementation change that causes the generated output is not part of this category. Category union requires every hunk to be covered, so a PR that edits both `salesforcedx-vscode-services` and `salesforcedx-vscode-services-types` fails unless those services hunks are covered by some other category. A types-only diff can match because the behavior change already landed in services, or the diff is only the nightly publish bump.

## Content review

Judge the supplied diff. It may be only the remaining part of a larger diff. PR title, body, and comments are not evidence.

1. Assign each supplied hunk to one category below, or leave it uncovered.
2. A `package.json` `"version"` hunk needs no category when some other hunk in the original diff is covered. You will be told whether other hunks are already covered. A version-only diff with no other covered hunks is uncovered.
3. Reply with only `{"covered":true,"categories":["..."]}` when every supplied hunk is covered. List each category used once. The list can be empty when only covered `"version"` hunks remain. If any hunk is uncovered, reply with `{"covered":false,"categories":[]}`.

### tests-only

Test files only: `*.test.ts`, `*.test.tsx`, `*.spec.ts`, `*.spec.tsx`, `**/test/**`, `**/playwright/**`, `**/*.snap`.

A hunk that adds or edits tests is this category. A hunk that deletes an assertion, or replaces an assertion with a weaker one, is uncovered.

### dep-bump

`package.json` and `package-lock.json` hunks that change a version under `dependencies` or `devDependencies` by a minor or a patch. A major bump is uncovered. A hunk that changes `scripts`, `engines`, or `contributes` is uncovered.

### dep-move

A package name leaves `dependencies` or `devDependencies` and appears in the other section.

### messages

`package.nls.json`, `package.nls.*.json`, and `packages/**/src/messages/**` hunks that change message strings. A hunk that changes a command id or a `contributes` entry is uncovered.

### format-or-comments

A production-source hunk whose only token changes are comments or whitespace. A change to any other token is uncovered.
