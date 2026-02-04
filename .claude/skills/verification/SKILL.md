---
name: verification
description: Verification steps for code changes. Use after ANY code change to ensure quality, or when creating plans because those should include verification steps.
---

# Verification

Do each of these steps, in order. Do not move to a step unless all previous are passing. Run these commands from the repo level. If you make any changes, go back to step 1.

1. `npm run compile` - See [references/compile.md](references/compile.md) for commands and errors
2. `npm run lint` - fix any new errors or warnings
3. `npm run test` - See [references/unit-tests.md]
4. `npm run vscode:bundle` to make sure the extensions still bundle

if working in [vscode-services, org-browser or metadata] extension, run headless tests for those extensions

- Run with `--retries 0` to get quicker feedback

5. `npm test:web`
6. `npm test:desktop`

7. `npx knip` - check for dead code related to your changes

- **Fix ALL unused exports** - if knip shows unused exports, remove them immediately unless they're used for tests
- Don't leave any exports that are only used within the same file

8. check for dupes `npm run check:dupes` and then look in `jscpd-report` to make sure none of your changes are flagged.

When you think you're done with changes 4.

## Rules

- Don't change /src AND /test together (except imports/renames)
- Be aware of wireit caching; You can look in the bundle to see (and also turn off `minify` if that helps debug)
- Port 3001 for tests (not 3000 - Docker/Grafana uses that)
- All commands run from salesforcedx-vscode root; use `-w` to specify runs for a single package. Never `cd` into a package.
- do not say a test/compile/lint failure was "pre-existing" without running the same operation on a previous version of the code before the current un-pushed commits began.

## Troubleshooting

- if knip fails due to `ERR_MODULE_NOT_FOUND` you can `rm -rf ~/.npm/_npx` and re-run it. You'll have to agree to it (or pass `-y` to it)

## Plans

When creating plans in plan mode, always include verification steps after the "actual" todos. The verification steps should follow this checklist.

## References

- `references/unit-tests.md` - Running unit tests
- `references/compile.md` - Compilation commands and TS4023 errors
- `@.claude/skills/playwright-e2e/` - Playwright E2E testing guidelines
