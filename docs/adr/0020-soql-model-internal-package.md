# soql-model internal package

`@salesforce/soql-model` is a real workspace package (`packages/soql-model`) but stays **private**: consumed via `"*"` ranges, never published to npm. It was previously a quasi-package inside `salesforcedx-vscode-soql/src/soql-model`, faked as `@salesforce/soql-model` through four alias mechanisms (tsconfig `paths`, two jest `moduleNameMapper`s, one rollup alias) — a leftover from the abandoned soql-tooling → vscode move ([PR #6821](https://github.com/forcedotcom/salesforcedx-vscode/pull/6821)).

## Decision

Promote it to a first-class package so the `@salesforce/soql-model` specifier resolves through real Node module resolution (one `exports` `.` entry, top-level curated barrel) instead of four parallel alias fakes that drift independently. Keep it `private: true` — no external consumer exists, so publishing would be pure overhead (versioning, changelog, npm release) with no benefit.

## Considered Options

Publish like its sibling [`soql-common`](../../packages/soql-common/package.json) (`versionedIndependently` + public). Rejected: soql-common is published because external tooling consumes it; soql-model has only in-repo consumers (`salesforcedx-vscode-soql`). Publishing adds release machinery for zero downstream gain.

## Consequences

Invariant: **`soql-common` must never import `soql-model`.** soql-common is published; an edge into a private `"*"` package would make soql-common unpublishable (npm cannot resolve `"*"`). Dependency direction is one-way: `salesforcedx-vscode-soql` → `soql-model` → `soql-common`.
