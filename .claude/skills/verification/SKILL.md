---
name: verification
description: Verification steps for code changes. Use after ANY code change to ensure quality, or when creating plans because those should include verification steps.
---

# Verification

The stop hook runs compile, lint, effect LS, test, and vscode:bundle automatically when the agent stops — no need to run these manually.

Run these **only if the stop hook doesn't catch them**:

1. **Knip / unused exports** — `npx knip` (see [ts4023 exceptions](../ts4023-effect-errors/SKILL.md))
   - Fix ALL unused exports unless test-only or ts4023 exception
   - Remove exports only used within the same file
   - If fails with `ERR_MODULE_NOT_FOUND`: `rm -rf ~/.npm/_npx` then re-run with `-y`

2. **Dupes** — `npm run check:dupes`, check `jscpd-report` for flagged changes

3. **Playwright** (only if working in these packages: `salesforcedx-vscode-core`, `salesforcedx-vscode-org`, `salesforcedx-vscode-services`, `salesforcedx-vscode-org-browser`, `salesforcedx-vscode-metadata`, `salesforcedx-vscode-apex-testing`, `salesforcedx-vscode-apex-log`, `playwright-vscode-ext`)
   - Run from root: `npm run test:web -w <package-name> -- --retries 0` / `npm run test:desktop -w <package-name> -- --retries 0`

## Rules

- Don't change /src AND /test together (except imports/renames)
- All commands run from repo root; use `-w` for single package, never `cd` into a package
- Don't call a failure "pre-existing" without verifying on a prior commit

## Plans

Include verification steps after the "actual" todos. Follow this checklist.

## References

- `references/unit-tests.md` — unit tests
- `references/compile.md` — compile; TS4023 / TS1261 skills
- `@.claude/skills/ts4023-effect-errors/` — TS4023
- `@.claude/skills/ts1261-filename-casing/` — TS1261
- `@.claude/skills/playwright-e2e/` — Playwright E2E
