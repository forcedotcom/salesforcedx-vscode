---
description: Running the complete E2E test suite locally
---

# Running Full E2E Test Suite

**Invoke when**: User asks to "run all E2E tests", "run the full test suite", or "run all playwright tests locally".

## Critical Rules

1. **Sequential execution ONLY** — Never run multiple packages or web/desktop in parallel. Each test command must complete before starting the next.
2. **Web-first** — For packages with both configs, always run web tests before desktop tests (avoids electron pop-ups on failure).
3. **Run from repo root** — Always use `npm run test:web -w packages/<name>` (not `cd packages/<name> && npm run test:web`).
4. **Trust wireit** — Don't pre-build or set WIREIT_CACHE=none for full suite. Let wireit manage dependencies.
5. **Keep retries** — Use default 2 retries (handles flaky tests). Don't add `--retries 0` for full suite.

## Execution Order

Run packages in this exact order (dependency-based):

1. **@salesforce/playwright-vscode-ext** (base test library)
   - web → desktop
2. **salesforcedx-vscode-services**
   - web → desktop
3. **salesforcedx-vscode-metadata**
   - web → desktop → desktop:conflicts (separate project, requires non-tracking and tracking scratch orgs)
4. **salesforcedx-vscode-apex-log**
   - web → desktop
5. **salesforcedx-vscode-apex-testing**
   - web → desktop
6. **salesforcedx-vscode-org-browser**
   - web → desktop
7. **salesforcedx-vscode-soql**
   - web → desktop
8. **salesforcedx-vscode-core**
   - **desktop only** (no web config)
9. **salesforcedx-vscode-apex-replay-debugger**
   - **desktop only** (no web config)

## Per-Package Execution Pattern

For each package:

1. **Check for web config**: `ls packages/<name>/playwright.config.web.ts`
2. **If web config exists**, run web tests:
   ```bash
   npm run test:web -w packages/<name>
   ```
   Wait for completion. If failure, invoke Failure Analysis Protocol (below).

3. **Check for desktop config**: `ls packages/<name>/playwright.config.desktop.ts`
4. **If desktop config exists**, run desktop tests:
   ```bash
   npm run test:desktop -w packages/<name>
   ```
   Wait for completion. If failure, invoke Failure Analysis Protocol (below).

5. **Check for `test:desktop:conflicts` script** in `package.json`. If present, run it after desktop:
   ```bash
   npm run test:desktop:conflicts -w packages/<name>
   ```
   This runs a separate playwright project (`conflicts`) scoped to `specs-conflicts/`. Sequential workers, 120s timeout.

6. **Move to next package** only after all phases complete successfully (or are skipped).

## Failure Analysis Protocol

When a test fails:

### Step 1: Check for Flakiness
- Run `git log --since="7 days ago" -- <test-file>.spec.ts` to see if test was modified recently
- Run `git log --since="7 days ago" -- <source-directory>` to see if tested code changed recently
- **If no recent changes**: Retry the specific failed test once:
  ```bash
  WIREIT_CACHE=none npm run test:web -w <package> -- --retries 0 test/playwright/specs/<failed-test>.spec.ts
  ```
  (WIREIT_CACHE=none is REQUIRED for individual test runs - see `references/iterating-playwright-tests.md`)

### Step 2: Gather Context
- Read test output/error from command execution
- Identify failed test file and line number
- Find test-results directory: `packages/<package-name>/test-results/`

### Step 3: Ask User
Ask user: "Test failed. Would you like me to analyze screenshots, traces, and spans?"

### Step 4: Analyze Artifacts (if user says yes)

**Screenshots**:
- Location: `packages/<package-name>/test-results/`
- Read screenshot files matching test name
- Describe what UI state is shown

**Span files**:
- Location: `~/.sf/vscode-spans/`
- Find latest: `ls -lt ~/.sf/vscode-spans/`
- Web tests: `web-*.jsonl` files
- Desktop tests: `node-*.jsonl` files
- Format: JSONL (one JSON object per line)
- Parse and check for timing issues, errors, or unexpected spans

**Playwright reports**:
- HTML report: `test-results/playwright-report/index.html`
- Mention to user they can open in browser for interactive view

**Reference error patterns**:
- Check `references/iterating-playwright-tests.md` "Things to ignore" section
- Filter out expected errors (TS extension activation, disabled extensions notification)

### Step 5: Synthesize Analysis
- Identify what test was trying to do
- Compare expected vs actual from screenshots
- Check span timing for timeouts/performance issues
- Propose what might be wrong:
  - UI changed (locator needs update)
  - Timing issue (needs better wait)
  - Regression (feature broke)
  - Flaky test (intermittent failure)
  - Test assumption wrong

### Step 6: Present to User
- Show analysis with evidence (screenshot descriptions, error messages, span data)
- Propose potential fixes or investigations
- **Ask how to proceed**:
  1. Fix the issue (but NEVER make code changes without explicit permission)
  2. Skip this package and continue with remaining packages
  3. Stop the entire test suite run

## Important Notes

- **Package name mappings**:
  - `playwright-vscode-ext` = `@salesforce/playwright-vscode-ext`
  - `org-browser` = `salesforcedx-vscode-org-browser`
- **Config detection**: Some packages only have desktop tests (core, apex-replay-debugger) - skip web phase for these
- **Span files**: Auto-enabled locally (not in CI). No manual setup needed.
- **Individual test retry**: Always use `WIREIT_CACHE=none` when running specific test files (not full suite)
- **Never parallel**: Tests CANNOT run in parallel - causes conflicts and unreliable results
- **Failure = stop**: Don't continue to next package until current package failure is resolved or user chooses to skip

## Example Full Suite Run

```bash
# Package 1: playwright-vscode-ext
npm run test:web -w packages/playwright-vscode-ext
npm run test:desktop -w packages/playwright-vscode-ext

# Package 2: services
npm run test:web -w packages/salesforcedx-vscode-services
npm run test:desktop -w packages/salesforcedx-vscode-services

# Package 3: metadata (has conflicts project)
npm run test:web -w packages/salesforcedx-vscode-metadata
npm run test:desktop -w packages/salesforcedx-vscode-metadata
npm run test:desktop:conflicts -w packages/salesforcedx-vscode-metadata

# ... continue through all 9 packages
```

Each command must complete and be analyzed before proceeding to the next.
