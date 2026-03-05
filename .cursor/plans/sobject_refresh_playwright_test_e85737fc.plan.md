---
name: SObject Refresh Playwright Test
overview: Create a Playwright headless spec to replace the failing vscode-extension-tester sObjectsDefinitions.e2e.ts test, using the dreamhouse org's existing custom objects (Broker__c, Property__c) instead of pushing new ones.
todos:
  - id: create-spec
    content: Create `refreshSObjectDefinitions.headless.spec.ts` with dreamhouse fixture, 3 steps (Custom/Standard/All), output channel verification
    status: completed
  - id: disable-workflows
    content: Temporarily disable non-metadata E2E workflows + Commit Workflow on this branch; filter metadataE2E to only run the new spec
    status: completed
  - id: verify-local
    content: 'Run verification: compile, lint, test:web --retries 0, test:desktop --retries 0'
    status: completed
  - id: push-and-monitor
    content: 'Commit with test: prefix, push, monitor GHA with playwright-e2e-monitor until passing on all platforms (Mac web+desktop, Windows desktop)'
    status: completed
  - id: restore-workflows
    content: Restore all temporarily disabled workflows, commit, push, verify everything still passes
    status: pending
isProject: false
---

# SObject Refresh Playwright Test

## Context

The existing [sObjectsDefinitions.e2e.ts](packages/salesforcedx-vscode-automation-tests/test/specs/sObjectsDefinitions.e2e.ts) test is timing out in CI because it waits for a `"successfully ran"` notification that the metadata extension's `refreshSObjectsCommand` never sends. The command uses `MetadataDescribeService` (REST API calls, no CLI) and writes results to the `'Salesforce Metadata'` output channel.

## CI Failure Analysis

The E2E monitor confirmed: the command executes (`executeQuickPick` returns), but the old test-tools notification (`/SFDX: Refresh SObject Definitions successfully ran/`) is never shown. The metadata extension fires `sf.internal.sobjectrefresh.complete` and writes `"Processed N {type} sObjects"` to the output channel -- no notification is sent. Each attempt waits ~1h for the notification, 3 attempts = 3h timeout.

## New Test File

Create `packages/salesforcedx-vscode-metadata/test/playwright/specs/refreshSObjectDefinitions.headless.spec.ts`

## Design

- **Fixture**: `dreamhouseTest` from `../fixtures` (dreamhouse org already has `Broker__c`, `Property__c` deployed -- no push step needed)
- **Spec type**: `*.headless.spec.ts` (web + desktop). The refresh command uses `MetadataDescribeService` REST API, not CLI.
- **Verification**: Output channel text only (`'Salesforce Metadata'` channel), matching existing metadata test patterns
- **Timeout**: `RETRIEVE_TIMEOUT` (10 min) -- standard objects can take a while

## Test Structure

Single test, 3 sequential `test.step`s -- Custom first (fastest, fail early), then Standard, then All:

```typescript
import { dreamhouseTest as test } from '../fixtures';
import { expect } from '@playwright/test';
import {
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  waitForVSCodeWorkbench,
  assertWelcomeTabExists,
  closeWelcomeTabs,
  createDreamhouseOrg,
  upsertScratchOrgAuthFieldsToSettings,
  executeCommandWithCommandPalette,
  ensureOutputPanelOpen,
  selectOutputChannel,
  clearOutputChannel,
  waitForOutputChannelText,
  validateNoCriticalErrors,
  saveScreenshot,
  ensureSecondarySideBarHidden,
  QUICK_INPUT_WIDGET,
  QUICK_INPUT_LIST_ROW
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../package.nls.json';
import { RETRIEVE_TIMEOUT } from '../../constants';
```

Each refresh step:

1. `ensureOutputPanelOpen` + `selectOutputChannel(page, 'Salesforce Metadata')` + `clearOutputChannel`
2. `executeCommandWithCommandPalette(page, packageNls.sobjects_refresh)`
3. Wait for quick pick, select the type option (e.g. `'Custom SObjects'`) via `QUICK_INPUT_LIST_ROW`
4. `waitForOutputChannelText(page, { expectedText: 'Custom sObjects', timeout: RETRIEVE_TIMEOUT })`

The quick pick options come from [i18n.ts](packages/salesforcedx-vscode-metadata/src/messages/i18n.ts) lines 90-92:

- `'All SObjects'`, `'Custom SObjects'`, `'Standard SObjects'`

Output channel writes from [refreshSObjects.ts](packages/salesforcedx-vscode-metadata/src/commands/refreshSObjects.ts) lines 88-95:

- `"Processed N Standard sObjects"` and/or `"Processed N Custom sObjects"`

## Quick Pick Interaction Pattern

After `executeCommandWithCommandPalette` selects the command, a second quick pick appears. Select the type:

```typescript
const quickInput = page.locator(QUICK_INPUT_WIDGET);
await quickInput.waitFor({ state: 'visible', timeout: 10_000 });
const row = quickInput.locator(QUICK_INPUT_LIST_ROW).filter({ hasText: typeName });
await row.click();
```

Existing pattern reference: [apexGenerateClass.headless.spec.ts](packages/salesforcedx-vscode-metadata/test/playwright/specs/apexGenerateClass.headless.spec.ts) lines 61-75 (handles sequential quick picks).

## Temporary CI Changes (for iteration)

During development, disable all other workflows so only the new test runs on push. Restore them before merging.

### Workflows to disable (add `'sm/feedback-3'` to `branches-ignore`)

These all have `push: branches-ignore: [main, develop]` -- add this branch:

- [testCommitExceptMain.yml](.github/workflows/testCommitExceptMain.yml) -- Commit Workflow (build/lint/unit tests)
- [apexLogE2E.yml](.github/workflows/apexLogE2E.yml)
- [apexReplayDebuggerE2E.yml](.github/workflows/apexReplayDebuggerE2E.yml)
- [apexTestingE2E.yml](.github/workflows/apexTestingE2E.yml)
- [coreE2E.yml](.github/workflows/coreE2E.yml)
- [orgBrowserE2E.yml](.github/workflows/orgBrowserE2E.yml)
- [playwrightVscodeExtE2E.yml](.github/workflows/playwrightVscodeExtE2E.yml)
- [servicesE2E.yml](.github/workflows/servicesE2E.yml)

### Filter metadataE2E.yml to only run the new test

Add `--grep "Refresh SObject Definitions"` to all 4 test run commands (try-run + parallel-run in both e2e-web and e2e-desktop jobs). Example:

```yaml
npm run test:web -w salesforcedx-vscode-metadata -- --grep "Refresh SObject Definitions" --reporter=html
```

Also skip the minimal org and non-tracking org creation steps (they aren't needed for this test, saves ~5 min per job). Comment out or add `if: false` to:

- "Generate minimal project" + "create scratch org" (minimal)
- "Generate non-tracking project" + "create non-tracking scratch org"

## Verification and Iteration Loop

1. **Local**: compile, lint, `test:web --retries 0`, `test:desktop --retries 0`
2. **Push**: commit with `test:` prefix, push to `sm/feedback-3`
3. **Monitor**: use playwright-e2e-monitor to watch the Metadata E2E workflow
4. **Iterate** until passing on all 4 targets:

- GHA web (ubuntu)
- GHA desktop (macos-latest)
- GHA desktop (windows-latest)
- Local web + desktop

1. **Restore**: remove `'sm/feedback-3'` from all `branches-ignore` lists, remove `--grep` filter from metadataE2E, uncomment minimal/non-tracking org steps
2. **Final push**: commit restore changes, push, verify full suite still passes
