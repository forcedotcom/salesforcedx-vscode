---
name: playwright-e2e
description: writing, running, and debugging Playwright tests. working with their output from github actions
---

# Playwright E2E Tests

Guidelines for writing and iterating on Playwright tests for VS Code extensions.

## Required Reading

**Read ALL before responding:**

- `references/coding-playwright-tests.md` - Writing tests
- `references/local-setup.md` - Scratch org setup (Dreamhouse, minimal, non-tracking)
- `references/iterating-playwright-tests.md` - Iterating on tests ("Things to ignore" for failure analysis)
- `references/analyze-e2e.md` - Analyzing E2E test results from CI

# Use playwright-vscode-ext

Shared code (helpers, locators, configuration) for tests.

## Span files (when debugging traces)

Local only — span export disabled in CI/GHA.

- Output: `~/.sf/vscode-spans/` — `web-*.jsonl` (test:web), `node-*.jsonl` (test:desktop)
- Auto-enabled when !CI (no manual enable needed)
- Latest: `ls -lt ~/.sf/vscode-spans/`
- Clear before run for fresh output: `rm -rf ~/.sf/vscode-spans/`
- Format: JSONL; parse each line with `JSON.parse`
- Fields: `name`, `traceId`, `spanId`, `parentSpanId`, `durationMs`, `status`, `startTime`, `attributes`

See `.claude/skills/span-file-export/SKILL.md` for enable/OTLP vs file.

## Running tests (AI behavior)

When running Playwright tests (`npm run test:web`, `test:desktop`, etc.), never block >30s. Use `is_background: true` so tests run while the AI continues. Check terminal output or `output_file` later.

## Disable/reenable other E2E when iterating

To run only your new test in CI while iterating:

1. **Disable other workflows** — add your branch to `branches-ignore` in `.github/workflows/*.yml` that have `push: branches-ignore: [main, develop]` (e.g. `testCommitExceptMain.yml`, `coreE2E.yml`, `orgBrowserE2E.yml`, etc.)
2. **Filter target workflow** — add `--grep "Your Test Title"` to the test run command in the workflow you care about
3. **Optional** — skip org setup steps not needed for your test (e.g. minimal/non-tracking orgs)
4. **Restore** — remove branch from `branches-ignore`, remove `--grep`, uncomment skipped steps

## References

- https://playwright.dev/docs - Playwright docs
