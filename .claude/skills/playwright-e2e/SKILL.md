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

**Desktop workspace shapes (pick one per test):**

- **No folder open** — fixture opens a Salesforce project, then call `prepareNoFolderOpenForPaletteTests(page)` (runs `Workspaces: Close Workspace` + workbench wait). Or use `closeWorkspaceToEmptyWindow` if UI is already prepared.
- **Folder open, no `sfdx-project.json`** — `createDesktopTest({ emptyWorkspace: true })`; workspace path comes from `createEmptyTestWorkspace()` (also exported from the package).
- **Default org in workspace** — pass `orgAlias: '…'` (e.g. `MINIMAL_ORG_ALIAS` / `DREAMHOUSE_ORG_ALIAS`) so `.sfdx/config.json` gets `target-org`. Omit `orgAlias` or use `undefined` for **no** `config.json` (no org).
- **Multi-package directory, no org** — `multiPackageNoOrgDesktopTest` (extend `noOrgDesktopTest`); creates a temp workspace with `sfdx-project.json` listing multiple `packageDirectories` (`force-app`, `extra-pkg`). Use `multiPackageNoOrgTest` from `fixtures/index.ts` in test files.

**VSIX mode** (`useVsix` option):

- `createDesktopTest({ useVsix: true })` — installs built VSIXs into a hash-keyed cache dir (`.vscode-test/ext-<hash>/`) and launches VS Code with `--extensions-dir` instead of `--extensionDevelopmentPath`. Exercises real shipping artifact (bundled `dist/`, `.vscodeignore`, `packageUpdates`).
- Default: `process.env.E2E_FROM_VSIX === '1'` — set in CI to enable without code changes.
- Requires `vscode:package` to have run first (produces `.vsix` in package dir). org-browser `test:desktop` depends on `vscode:package` for this reason.
- Idempotent across parallel workers: atomic rename; second worker skips if cache exists.

## Span files (when debugging traces)

Available local + CI/GHA.

- Output: `~/.sf/vscode-spans/` — `web-*.jsonl` (test:web), `node-*.jsonl` (test:desktop)
- Auto-enabled (no manual enable needed)
- CI runs: copied into package `test-results/spans/` artifacts (see workflow upload/download in `references/analyze-e2e.md`)
- Latest: `ls -lt ~/.sf/vscode-spans/`
- Clear before run for fresh output: `rm -rf ~/.sf/vscode-spans/`
- Format: JSONL; parse each line with `JSON.parse`
- Fields: `name`, `traceId`, `spanId`, `parentSpanId`, `durationMs`, `status`, `startTime`, `attributes`

See `.claude/skills/span-file-export/SKILL.md` for enable/OTLP vs file.

## Checking for Scratch Orgs

If you aren't sure if orgs are set up locally,

```bash
sf org list
```

Look for the required org aliases (e.g., `minimalTestOrg`, `nonTrackingTestOrg`, `orgBrowserDreamhouseTestOrg`). If missing, create them using the appropriate setup commands from `references/local-setup.md`.

**Pro tip**: Use `sf org list --json | jq '.result.scratchOrgs[] | select(.alias) | .alias'` to list only scratch org aliases.

## Running tests (AI behavior)

When running Playwright tests (`npm run test:web`, `test:desktop`, etc.), never block >30s. Use `is_background: true` so tests run while the AI continues. Check terminal output or `output_file` later.

## Running Full E2E Test Suite

See `references/full-suite-execution.md` for complete guide on running all E2E tests locally across all 9 packages in correct dependency order with failure analysis.

## Disable/reenable other E2E when iterating

To run only your new test in CI while iterating:

1. **Disable other workflows** — add your branch to `branches-ignore` in `.github/workflows/*.yml` that have `push: branches-ignore: [main, develop]` (e.g. `testCommitExceptMain.yml`, `coreE2E.yml`, `orgBrowserE2E.yml`, `lwcPlaywrightE2E.yml`, etc.)
2. **Filter target workflow** — add `--grep "Your Test Title"` to the test run command in the workflow you care about
3. **Optional** — skip org setup steps not needed for your test (e.g. minimal/non-tracking orgs)
4. **Restore** — remove branch from `branches-ignore`, remove `--grep`, uncomment skipped steps

## References

- https://playwright.dev/docs - Playwright docs
