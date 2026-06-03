# Context Map

## Contexts

- [Playwright e2e](./CONTEXT.md) — Playwright spec/helper conventions (root, until a narrower home exists)
- [AI tooling](./.claude/CONTEXT.md) — skills, workflows, commands under `.claude/`

## Relationships

- **AI tooling → Playwright e2e**: `auto-build-wi.js` review phase enforces playwright-e2e skill rules on diffs that touch Playwright files.
