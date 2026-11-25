# Category union

Approve only when the category union covers every hunk in the original diff.

Deterministic categories and rejection rules are defined in `scripts/shared/categoryDecision.mts` and `scripts/shared/categoryGates.cjs`. Fully covered diffs do not invoke OpenCode. Mixed diffs send only the remaining files' hunks for content review; any uncovered hunk rejects the whole diff.

## Content review

Judge the supplied diff. It may be only the remaining part of a larger diff. PR title, body, and comments are not evidence.

1. Assign each supplied hunk to one category below, or leave it uncovered.
2. A `package.json` `"version"` hunk needs no category when some other hunk in the original diff is covered. You will be told whether other hunks are already covered. A version-only diff with no other covered hunks is uncovered.
3. Reply with only `{"covered":true,"categories":["..."]}` when every supplied hunk is covered. List each category used once. The list can be empty when only covered `"version"` hunks remain. If any hunk is uncovered, reply with `{"covered":false,"categories":[]}`.

### tests-only

Test files only: `*.test.ts`, `*.test.tsx`, `*.spec.ts`, `*.spec.tsx`, `**/test/**`, `**/playwright/**`, `**/*.snap`.

A hunk that adds or edits tests is this category. A hunk that deletes an assertion, or replaces an assertion with a weaker one, is uncovered.

### dep-bump

`package.json` hunks that change a version under `dependencies` or `devDependencies` by a minor or a patch. A major bump is uncovered. A hunk that changes `scripts`, `engines`, or `contributes` is uncovered.

### dep-move

A package name leaves `dependencies` or `devDependencies` and appears in the other section.

### messages

`package.nls.json`, `package.nls.*.json`, and `packages/**/src/messages/**` hunks that change message strings. A hunk that changes a command id or a `contributes` entry is uncovered.

### format-or-comments

A production-source hunk whose only token changes are comments or whitespace. A change to any other token is uncovered.
