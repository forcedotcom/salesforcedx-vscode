---
name: apex-log E2E tests
overview: Plan E2E test structure for the salesforcedx-vscode-apex-log extension, covering execute anonymous, trace flag CRUD, log retrieval, and auto-collection — all sequential within a single CI job due to shared org trace flag state.
todos:
  - id: fixtures
    content: Create test/playwright/fixtures (index.ts + desktopFixtures.ts) for web and desktop; add spans:server dep to test:web wireit
    status: completed
  - id: exec-anon-spec
    content: Write executeAnonymous.headless.spec.ts covering document/selection execution and script creation
    status: completed
  - id: verify-exec-anon
    content: 'Verify executeAnonymous: compile, lint, test:web, test:desktop'
    status: completed
  - id: trace-crud-spec
    content: Write traceFlagsCrud.headless.spec.ts covering open/create/delete trace flags and debug levels
    status: completed
  - id: verify-trace-crud
    content: 'Verify traceFlagsCrud: compile, lint, test:web, test:desktop'
    status: completed
  - id: log-retrieval-spec
    content: Write logRetrieval.headless.spec.ts covering get logs and open folder
    status: completed
  - id: verify-log-retrieval
    content: 'Verify logRetrieval: compile, lint, test:web, test:desktop'
    status: completed
  - id: auto-collect-spec
    content: Write autoCollection.headless.spec.ts covering background log collection
    status: pending
  - id: verify-auto-collect
    content: 'Verify autoCollection: compile, lint, test:web, test:desktop'
    status: pending
  - id: trace-other-user-spec
    content: Write traceFlagsForOtherUser.headless.spec.ts covering create trace flag for another user via SOSL picker
    status: pending
  - id: verify-trace-other-user
    content: 'Verify traceFlagsForOtherUser: compile, lint, test:web, test:desktop'
    status: pending
  - id: ci-workflow
    content: Create apexLogE2E.yml workflow (web + desktop matrix, sequential, minimal org) and add to e2e.yml orchestrator
    status: pending
  - id: final-verify
    content: 'Final verification: compile, lint, vscode:bundle, knip, check:dupes'
    status: pending
isProject: false
---

# E2E Tests for salesforcedx-vscode-apex-log

## Required skill

Before writing any test code, read `.claude/skills/playwright-e2e/SKILL.md` and all its required references:

- `references/coding-playwright-tests.md` — test structure, waiting, selectors, commands, i18n
- `references/iterating-playwright-tests.md` — run sequence (web first, then desktop), debugging, cleanup rules
- `references/analyze-e2e.md` — CI artifact analysis

Key rules from the skill:

- One test per file, many steps allowed
- Never `waitForTimeout` — wait for specific page elements
- Never use Node.js fs/path or VS Code API (not available in web)
- Use `F1` for commands, `Control` for all shortcuts (not ControlOrMeta)
- Prefer `aria` (getByRole) over CSS selectors
- Use `package.nls.json` for command titles (not hardcoded strings)
- Check `playwright-vscode-ext` for reuse before creating utilities
- Iteration: run web locally first (`--retries 0`), then desktop, then CI

## Why one sequential job

Nearly every feature in this extension reads or mutates `TraceFlag` / `DebugLevel` Tooling API objects on the org. These are org-wide (DebugLevel) or per-user-but-globally-visible (TraceFlag). Parallel tests on the same org would race on create/update/delete and see each other's state. Even "read-only" features like the trace flags virtual document or status bar query _all_ trace flags, so a parallel test creating a flag would pollute assertions.

Execute anonymous also creates a short-lived trace flag behind the scenes, so it conflicts too.

**Decision: single CI job, `E2E_SEQUENTIAL=1` for the parallel step** (same retry pattern as other workflows). A minimal scratch org is sufficient — no special features required.

If we later find tests that are truly org-independent (e.g., purely local file operations like "create anonymous apex script" or "open logs folder"), those could be split into a separate parallel job. But the benefit is marginal for 4-5 test files.

## Test files

All under `packages/salesforcedx-vscode-apex-log/test/playwright/specs/`. One test per file, multiple steps.

### 1. `executeAnonymous.headless.spec.ts`

Covers: `sf.anon.apex.execute.document`, `sf.anon.apex.execute.selection`, `sf.create.anonymous.apex.script`

Steps:

1. Setup minimal org auth
2. Create anonymous apex script via command palette (`SFDX: Create Anonymous Apex Script`) — verify `.apex` file created
3. Type simple Apex (`System.debug('hello');`) into the file
4. Execute document (`SFDX: Execute Anonymous Apex with Currently Open Editor`) — wait for output channel text showing success
5. Verify `debug.log` tab opens (editor with `.log` extension)
6. Select partial text, execute selection (`SFDX: Execute Anonymous Apex with Editor's Selected Text`) — verify success
7. Execute with compile error (e.g., `Integer x = 'bad';`) — verify error notification

Key assertions: output channel shows "Ended", log file opens, compile error message shown.

### 2. `traceFlagsCrud.headless.spec.ts`

Covers: `sf.apex.traceFlags.open`, `sf.apex.traceFlags.createForCurrentUser`, `sf.apex.traceFlags.deleteForCurrentUser`, `sf.apex.traceFlags.createLogLevel`, code lenses

Steps:

1. Setup minimal org auth
2. Open trace flags (`SFDX: Open Trace Flags`) — verify virtual document opens with JSON content
3. Verify "Create trace flag for current user" code lens visible
4. Create trace flag for current user via command palette — verify:

- Status bar updates (shows expiration time)
- Virtual document refreshes to show the new trace flag
- "Remove" code lens appears

1. Create a debug level (`SFDX: Create Debug Level`) via command palette — fill in name, accept defaults — verify it appears in virtual doc
2. Delete trace flag for current user via command palette — verify status bar and virtual doc update
3. Clean up: delete the debug level via code lens

Key assertions: virtual document JSON content, status bar text, code lens presence.

### 3. `logRetrieval.headless.spec.ts`

Covers: `sf.apex.log.get`, `sf.apex.log.openFolder`

Steps:

1. Setup minimal org auth
2. Generate a log: execute anonymous apex (quick `System.debug('logtest');`)
3. Get apex debug log (`SFDX: Get Apex Debug Logs`) — verify quick pick appears with log entries
4. Select a log — verify log file opens in editor with `.log` content
5. Open logs folder (`SFDX: Open Apex Logs Folder`) — verify explorer opens

Key assertions: quick pick shows log entries, log content visible in editor.

### 4. `autoCollection.headless.spec.ts`

Covers: auto-collection background process, status bar collection count, log poll setting

Steps:

1. Setup minimal org auth
2. Set `logPollIntervalSeconds` to a short value (e.g., 10) via settings
3. Create trace flag for current user (to trigger auto-collection)
4. Generate some logs: execute anonymous apex
5. Wait for auto-collection to pick up logs (watch status bar for count update or output channel messages)
6. Verify collected log files exist (open logs folder, check for files)
7. Set `logPollIntervalSeconds` to -1 — verify auto-collection stops
8. Clean up: delete trace flag

Key assertions: status bar shows collection count, output channel logs collection messages.

### 5. `traceFlagsForOtherUser.headless.spec.ts`

Covers: `sf.apex.traceFlags.createForUser` (user picker with SOSL search)

Minimal scratch orgs have 7 active users (queried from current org):

- **User User** (System Administrator) — the default/current user
- **Integration User** (Analytics Cloud Integration User)
- **Security User** (Analytics Cloud Security User)
- **Chatter Expert** (Chatter Free User)
- **Automated Process**, **Data.com Clean**, **Platform Integration User** (no profile)

The SOSL user picker should find "Integration User" or "Security User" by partial name search.

Steps:

1. Setup minimal org auth
2. Open trace flags
3. Create trace flag for another user (`SFDX: Create Trace Flag for Another User`) — type "Integration" in search, select "Integration User"
4. Pick a debug level from the picker (use existing `SFDC_DevConsole`)
5. Verify trace flag appears in virtual doc under DEVELOPER_LOG group for that user
6. Clean up: delete the trace flag via code lens or command

## Shared fixtures (web + desktop)

Tests must work identically in web and desktop. Follow the apex-testing pattern with two fixture files:

`**fixtures/desktopFixtures.ts` — desktop Electron config (pattern from [apex-replay-debugger desktopFixtures](packages/salesforcedx-vscode-apex-replay-debugger/test/playwright/fixtures/desktopFixtures.ts)):

```typescript
import { createDesktopTest, MINIMAL_ORG_ALIAS } from '@salesforce/playwright-vscode-ext';
export const desktopTest = createDesktopTest({
  fixturesDir: __dirname,
  orgAlias: MINIMAL_ORG_ALIAS,
  additionalExtensionDirs: ['salesforcedx-vscode-metadata'],
  disableOtherExtensions: false,
  userSettings: {
    'github.gitAuthentication': false,
    'git.terminalAuthentication': false,
    'git.autofetch': false
  }
});
```

`**fixtures/index.ts**` — switches between web/desktop based on `VSCODE_DESKTOP` env var (pattern from [apex-testing index.ts](packages/salesforcedx-vscode-apex-testing/test/playwright/fixtures/index.ts)):

```typescript
import { test as webTest } from '@playwright/test';
import { desktopTest } from './desktopFixtures';
const isDesktop = process.env.VSCODE_DESKTOP === '1';
export const test = isDesktop ? desktopTest : webTest;
```

All specs import `test` from `../fixtures` — same file runs in both environments.

## Wireit scripts (already configured)

The apex-log `package.json` already has the correct wireit scripts matching the metadata/org-browser pattern:

- `test:web` — `playwright test --config=playwright.config.web.ts`, depends on `vscode:bundle`, `services:vscode:bundle`, `playwright-vscode-ext:compile`
- `test:desktop` — same with `VSCODE_DESKTOP=1` env
- `test:e2e` — aggregates both
- `test:web:ui`, `test:web:debug`, `test:desktop:debug` — convenience scripts

One change needed: add `../salesforcedx-vscode-services:spans:server` dependency to `test:web` (matching metadata/org-browser pattern for local span debugging).

## CI Workflow

Create `.github/workflows/apexLogE2E.yml` following [apexTestingE2E.yml](.github/workflows/apexTestingE2E.yml) pattern:

- **Two jobs**: `e2e-web` (ubuntu-latest) and `e2e-desktop` (macos-latest, windows-latest matrix) — same as apex-testing
- Same try-run/cache, org setup, retry structure
- `MINIMAL_ORG_ALIAS: minimalTestOrg`
- **Force sequential**: set `E2E_SEQUENTIAL=1` on both the main run and retry steps (not just retry)
- Workspace: `salesforcedx-vscode-apex-log`
- Desktop job sets `VSCODE_DESKTOP: 1` and installs Playwright browser
- Add to [e2e.yml](.github/workflows/e2e.yml) orchestrator

Key difference from other workflows: `E2E_SEQUENTIAL=1` on the main run step, not just the retry step.

## Existing shared helpers to reuse

From `@salesforce/playwright-vscode-ext`:

- `setupMinimalOrgAndAuth` — org auth setup
- `APEX_TRACE_FLAG_STATUS_BAR` locator (`locators.ts:36`) — already used by apex-replay-debugger test for `page.locator(APEX_TRACE_FLAG_STATUS_BAR).filter({ hasText: /Tracing until/ })` and `.filter({ hasText: /No Tracing/ })`
- `executeCommandWithCommandPalette`, `QUICK_INPUT_WIDGET`, `QUICK_INPUT_LIST_ROW` — command palette interactions
- Standard monitoring/validation helpers

May need a new helper for interacting with code lenses in virtual documents (could stay local initially, hoist to playwright-vscode-ext if replay-debugger or other extensions also need it).

## Verification cadence

After each spec is written, run the full verification loop before moving to the next:

1. `npm run compile` (repo root)
2. `npm run lint` (repo root)
3. `npm run test:web -w salesforcedx-vscode-apex-log -- --retries 0` (runs against real org)
4. `npm run test:desktop -w salesforcedx-vscode-apex-log -- --retries 0` (runs against real org)

After all specs + CI workflow are done, final pass:

1. `npm run vscode:bundle`
2. `npx knip`
3. `npm run check:dupes`

Also update `.claude/skills/verification/SKILL.md` to add `salesforcedx-vscode-apex-log` to the list of packages with `test:web`/`test:desktop` scripts.

## Test ordering concern

Since tests are sequential and each file is independent, each test should clean up its own org state (delete trace flags it created, delete debug levels). The `beforeEach` should also defensively check for / clean leftover state. This prevents test B from failing because test A left a trace flag active.

## File summary

| Location                                                        | Purpose                                   |
| --------------------------------------------------------------- | ----------------------------------------- |
| `test/playwright/fixtures/index.ts`                             | Web/desktop test fixture switcher         |
| `test/playwright/fixtures/desktopFixtures.ts`                   | Desktop Electron fixture config           |
| `test/playwright/specs/executeAnonymous.headless.spec.ts`       | Execute anonymous Apex workflows          |
| `test/playwright/specs/traceFlagsCrud.headless.spec.ts`         | Trace flag + debug level CRUD             |
| `test/playwright/specs/logRetrieval.headless.spec.ts`           | Get logs, open folder                     |
| `test/playwright/specs/autoCollection.headless.spec.ts`         | Auto-collection with polling              |
| `test/playwright/specs/traceFlagsForOtherUser.headless.spec.ts` | Create trace flag for another user (SOSL) |
| `.github/workflows/apexLogE2E.yml`                              | CI workflow (sequential)                  |
