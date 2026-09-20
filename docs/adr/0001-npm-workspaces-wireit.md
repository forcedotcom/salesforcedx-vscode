# Build orchestration: npm workspaces + Wireit (superseded)

Superseded by [ADR 0022](./0022-pnpm-cutover.md): pnpm replaced npm for package and workspace management; [Wireit](../../.claude/skills/wireit/SKILL.md) remains the task orchestrator.

## Considered Options

- **Lerna** — migrated off; `lerna.json` is gone (`949963eb2` "ci: wireit, not lerna").
- **NX** — introduced Apr 2025 (`310d37409` "ci: task caching") and removed by the Wireit migration (`7e4fc5d5e` "ci: wireit W-20391187", Dec 2025). `nx.json` is absent at HEAD. Tried and reverted — do not re-introduce.
