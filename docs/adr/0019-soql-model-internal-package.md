# soql-model is a real but internal workspace package

`soql-model` (SOQL AST model, serialization, validators) is a real npm-workspaces package `@salesforce/soql-model`, consumed within the repo via the `*` version, but marked `private: true` and never published. It was previously a quasi-package faked by four alias mechanisms (tsconfig `paths`, two jest `moduleNameMapper`s, a rollup `@rollup/plugin-alias` entry) with no manifest or build boundary — the tail of the soql-tooling→vscode move (PR #6821). Making it a real package gives it a real build/lint/test boundary and curated exports via [wireit](../../.claude/skills/wireit/SKILL.md) ([ADR-0001](0001-npm-workspaces-wireit.md)), without taking on publish overhead.

## Considered Options

- **Publish like [`soql-common`](../../packages/soql-common)** — rejected. soql-model has no external consumer; publishing is pure version/publish overhead.

## Consequences

Invariant: `soql-common` must never import `soql-model`. The dependency is upstream-only (`vscode-soql → soql-model → soql-common`); since soql-common *is* published, importing soql-model would force soql-model to publish too.
