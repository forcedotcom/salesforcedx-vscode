# Build orchestration: npm workspaces + Wireit

The monorepo uses npm workspaces with [Wireit](../../.claude/skills/wireit/SKILL.md) for task graph/caching, not Lerna and not NX. Wireit keeps task definitions in each `package.json` and caches by input fingerprint without a separate build tool.

## Considered Options

- **Lerna** — migrated off; `lerna.json` is gone (`949963eb2` "ci: wireit, not lerna").
- **NX** — introduced Apr 2025 (`310d37409` "ci: task caching") and removed by the Wireit migration (`7e4fc5d5e` "ci: wireit W-20391187", Dec 2025). `nx.json` is absent at HEAD. Tried and reverted — do not re-introduce.
