---
name: verification
description: Verification steps for code changes. Use after ANY code change to ensure quality, or when creating plans because those should include verification steps.
---

# Verification

Do each of these steps, in order. Do not move to a step unless all previous are passing. Run these commands from the repo level. If you make any changes, go back to step 1.

1. `npm run compile` — [references/compile.md](references/compile.md) (TS4023: [ts4023-effect-errors](../ts4023-effect-errors/SKILL.md), TS1261: [ts1261-filename-casing](../ts1261-filename-casing/SKILL.md))
2. `npm run lint` - fix any new errors or warnings
3. Effect code: `npx effect-language-service diagnostics --project tsconfig.json` (or `--file <path>`) — fix reported issues; `read_lints` does not surface Effect LS
4. `npm run test` - See [references/unit-tests.md](references/unit-tests.md)
5. `npm run vscode:bundle` to ensure the extensions still bundle

6. If working in packages with `test:web`/`test:desktop` scripts:
   - Package-level only (not in root): `salesforcedx-vscode-core`, `salesforcedx-vscode-org`, `salesforcedx-vscode-services` (web), `salesforcedx-vscode-org-browser`, `salesforcedx-vscode-metadata`, `salesforcedx-vscode-apex-testing`, `salesforcedx-vscode-apex-log`, `playwright-vscode-ext`
   - Run from root: `npm run test:web -w <package-name> -- --retries 0` / `npm run test:desktop -w <package-name> -- --retries 0` (use `--` to forward params to the underlying command)
   - Skip if not in these packages

7. `npx knip --no-config-hints --include exports,types,nsExports,nsTypes` - check for unused exports related to your changes

- **Fix ALL unused exports** - if knip shows unused exports, remove them immediately unless they're used for tests. Exception for [ts4023 reasons](../ts4023-effect-errors/SKILL.md)
- Don't leave any exports that are only used within the same file

8. check for dupes `npm run check:dupes` and then look in `jscpd-report` to make sure none of your changes are flagged.

## Rules

- Don't change /src AND /test together (except imports/renames)
- Be aware of wireit caching; You can look in the bundle to see (and also turn off `minify` if that helps debug)
- Web test port is auto-assigned (free port picked at config time, passed via PORT env var to headless server)
- All commands run from salesforcedx-vscode root; use `-w` to specify runs for a single package. Never `cd` into a package.
- do not say a test/compile/lint failure was "pre-existing" without running the same operation on a previous version of the code before the current un-pushed commits began.

## Troubleshooting

- if knip fails due to `ERR_MODULE_NOT_FOUND` you can `rm -rf ~/.npm/_npx` and re-run it. You'll have to agree to it (or pass `-y` to it)

## Plans

When creating plans in plan mode, always include verification steps after the "actual" todos. The verification steps should follow this checklist.

## References

- `references/unit-tests.md` — unit tests
- `references/compile.md` — compile; TS4023 / TS1261 skills
- `@.claude/skills/ts4023-effect-errors/` — TS4023
- `@.claude/skills/ts1261-filename-casing/` — TS1261
- `@.claude/skills/playwright-e2e/` — Playwright E2E
