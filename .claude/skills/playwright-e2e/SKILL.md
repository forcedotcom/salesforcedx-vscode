---
name: playwright-e2e
description: writing, running, and debugging Playwright tests; creating and recreating scratch orgs (Dreamhouse, minimal, non-tracking); working with their output from github actions
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
- **Default org in workspace** — pass `orgAlias: '…'` (e.g. `MINIMAL_ORG_ALIAS` / `NON_TRACKING_ORG_ALIAS` / `DREAMHOUSE_ORG_ALIAS`) so `.sfdx/config.json` gets `target-org`. Omit `orgAlias` or use `undefined` for **no** `config.json` (no org).
- **Multi-package directory, no org** — `multiPackageNoOrgDesktopTest` (extend `noOrgDesktopTest`); creates a temp workspace with `sfdx-project.json` listing multiple `packageDirectories` (`force-app`, `extra-pkg`). Use `multiPackageNoOrgTest` from `fixtures/index.ts` in test files.

**VSIX mode** (`useVsix` option):

- `createDesktopTest({ useVsix: true })` — installs built VSIXs into a hash-keyed cache dir (`.vscode-test/ext-<hash>/`) and launches VS Code with `--extensions-dir` instead of `--extensionDevelopmentPath`. Exercises real shipping artifact (bundled `dist/`, `.vscodeignore`, `packageUpdates`).
- Installs requested local VSIX dirs in `extensionDependencies` order (from each local `package.json`), so local dependency VSIXs install before dependents.
- Default: `process.env.E2E_FROM_VSIX === '1'` — set in CI to enable without code changes.
- Requires `vscode:package` to have run first (produces `.vsix` in package dir). `test:desktop` depends on `vscode:package` for this reason.
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

## Apex OAS E2E Tests

Playwright desktop tests live in `packages/salesforcedx-vscode-apex-oas/test/playwright/specs/` with dedicated CI workflow `.github/workflows/apexOasE2E.yml` (macOS + ubuntu, desktop only). Specs share one MINIMAL_ORG_ALIAS scratch org and are serialized via `workers: 1` in `playwright.config.desktop.ts`. Tests that deploy ESR metadata requiring API >=66 call `setWorkspaceApiVersion()` to bump the fixture's default sourceApiVersion (64.0 → 66.0). Specs that click modal-dialog buttons require `window.dialogStyle: custom` in the fixture's `userSettings`. The OAS REST generation path requires an LLM service registered with the VS Code service provider — supplied at runtime by A4V (`salesforce.salesforcedx-einstein-gpt`), which is no longer a declared `extensionDependency`. The AuraEnabled path needs only an active org. Specs exercising REST generation install A4V via the desktop fixture's pre-launch step; obtaining the LLM service is fail-fast, so `waitForA4VAndOasCommands` calls `waitForExtensionsActivated` to ensure the provider has registered its command before generation runs.

**A4V LLM rate limit = skip, not fail (pre-migration):** the shared Core model exhausting its monthly quota is an infra outage, not a product bug — it can hit *any* spec that triggers a generation LLM call (all composed/decomposed/context-menu specs), not just manual-merge. The extension surfaces it as a real error notification (`/monthly rate limit/`, from the `llm_monthly_rate_limit` i18n message) instead of the old generic "LLM did not return any content", so specs detect it straight from the UI — no span-file scan. Wrap the generation success signal with `assertGenerationOrSkipOnRateLimit(test, page, success)` (oasHelpers): `success` is the success assertion (`expect(tab).toBeVisible()` or `waitForEsrFile(...)`); it races the rate-limit notification and `test.skip`s if that wins, else resolves/rethrows. The eligibility-failure specs (`ineligibleClass`, `mixedFrameworksClass`, `restResourceNoHttpMethod`) fail before any LLM call and need no guard.

## Running Full E2E Test Suite

See `references/full-suite-execution.md` for complete guide on running all E2E tests locally across all 9 packages in correct dependency order with failure analysis.

## Disable/reenable other E2E when iterating

To run only your new test in CI while iterating:

1. **Disable other workflows** — add your branch to `branches-ignore` in `.github/workflows/*.yml` that have `push: branches-ignore: [main, develop]` (e.g. `testCommitExceptMain.yml`, `coreE2E.yml`, `orgBrowserE2E.yml`, `lwcPlaywrightE2E.yml`, etc.)
2. **Filter target workflow** — add `--grep "Your Test Title"` to the test run command in the workflow you care about
3. **Optional** — skip org setup steps not needed for your test (e.g. minimal/non-tracking orgs)
4. **Restore** — remove branch from `branches-ignore`, remove `--grep`, uncomment skipped steps

## Reliable Assertions for Async Operations

For desktop-only tests, prefer durable success signals over flaky UI assertions:

- **Avoid**: `vscode.window.showInformationMessage` toasts auto-dismiss in seconds; `notification-list-item` assertions are racy
- **Prefer**: Poll on-disk artifacts (e.g., generated files) with exponential backoff. Example: `waitForEsrFile` checks `fs.access` repeatedly until artifact appears or timeout.
- Pattern: Create a helper that polls `fs.access` or `fs.stat` with `Date.now() < deadline` loop; throw on timeout with clear error message

## References

- https://playwright.dev/docs - Playwright docs
