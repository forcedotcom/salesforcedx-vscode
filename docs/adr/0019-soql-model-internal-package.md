# soql-model is a real but internal workspace package

`soql-model` (SOQL AST model, serialization, validators) is a real npm-workspaces pkg `@salesforce/soql-model`, consumed in-repo via `*`, `private: true`, not published. Previously a quasi-pkg faked by 4 alias mechanisms (tsconfig `paths`, 2 jest `moduleNameMapper`s, rollup `@rollup/plugin-alias`), no manifest/boundary — tail of soql-tooling→vscode move (PR #6821). Real pkg provides build/lint/test boundary + curated exports via [wireit](../../.claude/skills/wireit/SKILL.md) ([ADR-0001](0001-npm-workspaces-wireit.md)), no publish overhead.

## Considered Options

- **Publish like [`soql-common`](../../packages/soql-common)** — rejected. soql-model has no external consumer; publishing is pure version/publish overhead.

## Consequences

Invariant: `soql-common` must never import `soql-model`. The dependency is upstream-only (`vscode-soql → soql-model → soql-common`); since soql-common *is* published, importing soql-model would force soql-model to publish too.
