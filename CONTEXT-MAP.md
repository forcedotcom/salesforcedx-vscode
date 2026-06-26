# Context Map

## Contexts

- [Playwright e2e](./CONTEXT.md) — Playwright spec/helper conventions (root, until a narrower home exists)
- [AI tooling](./.claude/CONTEXT.md) — skills, workflows, commands under `.claude/`
- [salesforcedx-vscode-apex-testing](./packages/salesforcedx-vscode-apex-testing/CONTEXT.md) — apex test glossary (org-only vs project test, discovery VFS, TestController shell, namespace/package grouping)
- [salesforcedx-vscode-services](./packages/salesforcedx-vscode-services/CONTEXT.md) — services extension glossary (HashableUri, etc.)
- [salesforcedx-vscode-org](./packages/salesforcedx-vscode-org/CONTEXT.md) — org extension glossary (deletable org, `sf:default_org_deletable`, delete-default vs picker)

## Relationships

- **AI tooling → Playwright e2e**: `auto-build-wi.js` review phase enforces playwright-e2e skill rules on diffs that touch Playwright files.
