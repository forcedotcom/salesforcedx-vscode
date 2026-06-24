# LWC Test Run Feedback — Route All Entry Points Through the Test Controller (W-23094301)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the one-shot LWC test entry points (command palette, editor-title play/debug buttons, code lens) run through VS Code's native Test Controller so the user always gets native run feedback (spinners, progress, Test Results) instead of the silent bare-task path. **Watch mode is deferred to a follow-up WI** (see "Scope" below).

**Architecture:** Today two run engines coexist. The Test Controller (`LwcTestController.runTests`/`executeOne`) drives the native Test Run UI; the command/code-lens/toolbar/watch handlers call `TestRunner.executeAsSfTask()`, which spawns a task with `reveal: TaskRevealKind.Never` and gives no feedback. We expose public run methods on the controller singleton and repoint the run/debug command handlers at them. The bare-task path (`executeAsSfTask`) and the "out-of-band results" indexer listener **stay for now** because watch mode still depends on them; they are removed in the watch follow-up.

## Scope (revised 2026-06-24)

**In this branch (`ph/W-23094301-lwc-test-feedback`):** Tasks 1-4 (run + debug routing), Task 8b (verify out-of-band listener still needed for watch — keep it), Task 9 (verification). One-shot run/debug from palette, editor-title button, and code lens all gain native feedback.

**Progress:** ✓ Task 1 completed (getLwcTestController + runByExecutionInfo), ✓ Task 2 completed (runActiveEditorFile convenience method). Next: Task 3 (run command routing).

**Deferred to follow-up WI:** Tasks 5-7 (native Continuous Run profile for watch, watch toggle methods, repointing watch handlers, deleting `TestWatcher`) AND the final removal of `executeAsSfTask` + the out-of-band results listener. These are interdependent: watch can't lose `executeAsSfTask` until it has the Continuous Run replacement. Tasks 5-7 below are retained for reference but **NOT executed in this branch** — they seed the follow-up plan.

**Tech Stack:** TypeScript, VS Code Extension API (`vscode.tests`, `TestController`, `TestRunProfile`, `TestRunRequest`), Jest (`test/jest/...`), the existing `lwcTestIndexer` (discovery) and `TestRunner` (jest arg/shell construction).

## Global Constraints

- File naming: lowerCamelCase `.ts` files (matches existing `lwcTestController.ts`, `lwcTestRunAction.ts`). Copy verbatim per repo `typescript` skill.
- Prefer `vscode-uri` (`URI`, `Utils`) over `node:path` for URI work (repo `paths` skill). `node:path` is only acceptable where the file already uses it (`testRunner.ts` for jest `--runTestsByPath`).
- No new user-facing strings without an entry in BOTH `src/messages/i18n.ts` and `src/messages/i18n.ja.ts`.
- Web-extension compatibility: do not introduce `fs.realpathSync` or other node-fs calls in shared paths; the controller already uses `vscode.workspace.fs`.
- All run/debug logic must continue to attribute Jest results to `TestItem`s via the controller's existing `applyResults` path.
- Telemetry: the existing run/debug/watch telemetry log names (`LWC_TEST_RUN_LOG_NAME`, `LWC_TEST_DEBUG_LOG_NAME`, `LWC_TEST_WATCH_LOG_NAME`) must keep firing. Run/debug telemetry currently rides on `TestRunner` (`logName`) and the debug-session handlers; preserve equivalent events after the cutover.
- Commit after each task. Conventional commit messages, append ` - W-23094301` is NOT required on commits (only PR titles) — keep commit subjects scoped, e.g. `feat(lwc): ...`.

---

## File Structure

- `packages/salesforcedx-vscode-lwc/src/testSupport/testExplorer/lwcTestController.ts` — add public run API (`runActiveEditorFile`, `runActiveEditorFileDebug`, `runByExecutionInfo`), add a Continuous Run profile, expose `getOrCreateFileItemForUri`/case resolution, remove the out-of-band results listener. Export the singleton accessor.
- `packages/salesforcedx-vscode-lwc/src/testSupport/commands/lwcTestRunAction.ts` — repoint run handlers at the controller; delete `lwcTestRun`/`executeAsSfTask` usage.
- `packages/salesforcedx-vscode-lwc/src/testSupport/commands/lwcTestDebugAction.ts` — repoint debug handlers at the controller (keep `handleDidStart/TerminateDebugSession` telemetry).
- `packages/salesforcedx-vscode-lwc/src/testSupport/commands/lwcTestWatchAction.ts` — repoint watch start/stop at the controller's continuous-run state.
- `packages/salesforcedx-vscode-lwc/src/testSupport/testRunner/testWatcher.ts` — delete (replaced by controller continuous-run state) OR reduce to a thin state tracker; see Task 7.
- `packages/salesforcedx-vscode-lwc/src/testSupport/testRunner/testRunner.ts` — remove `executeAsSfTask` once no callers remain.
- `packages/salesforcedx-vscode-lwc/test/jest/testSupport/testExplorer/lwcTestController.test.ts` — extend.
- `packages/salesforcedx-vscode-lwc/test/jest/testSupport/commands/*.test.ts` — new.

---

### Task 1: Expose the controller singleton + a public "run by execution info" method

**Files:**
- Modify: `packages/salesforcedx-vscode-lwc/src/testSupport/testExplorer/lwcTestController.ts`
- Test: `packages/salesforcedx-vscode-lwc/test/jest/testSupport/testExplorer/lwcTestController.test.ts`

**Interfaces:**
- Consumes: existing private `runTests(request, token, isDebug)`, `getOrCreateFileItem`, `resolveFileChildren`, `fileItems`/`caseItems` maps, `createFileId`, `createCaseId`.
- Produces:
  - `export const getLwcTestController: () => LwcTestController` (already exists privately at line 537 — promote to export).
  - New public method `public runByExecutionInfo = async (info: TestExecutionInfo, isDebug: boolean): Promise<void>` that resolves the matching `TestItem` (file or case), builds a `vscode.TestRunRequest([item], undefined, profile)`, and calls the run profile's `runHandler` (i.e. `this.runTests(request, token, isDebug)` with a fresh `CancellationTokenSource().token`).
  - New private helper `private resolveItemForExecutionInfo = async (info: TestExecutionInfo): Promise<vscode.TestItem | undefined>` — for `kind === 'testFile'` returns/creates the file item; for `kind === 'testCase'` ensures the parent file item exists, resolves its children, then returns the case item whose label matches `info.testName`.

- [x] **Step 1: Write the failing test** — add to `lwcTestController.test.ts` a new `describe('LwcTestController public run API', ...)`.

```typescript
describe('LwcTestController public run API', () => {
  it('runByExecutionInfo resolves a file item and starts a test run', async () => {
    const testUri = URI.file('/project/force-app/lwc/foo/__tests__/foo.test.js');
    const createdRuns: any[] = [];
    let runHandler: ((request: any, token: any) => unknown) | undefined;

    const controller = {
      resolveHandler: undefined,
      refreshHandler: undefined,
      items: {
        replace: jest.fn(),
        forEach: jest.fn()
      },
      createTestItem: (id: string, label: string, uri?: URI) => ({
        id,
        label,
        uri,
        canResolveChildren: false,
        tags: [],
        children: { replace: jest.fn(), forEach: jest.fn() }
      }),
      // capture the Run profile's handler so the test can assert a run is created
      createRunProfile: jest.fn((_label, kind, handler) => {
        if (kind === vscode.TestRunProfileKind.Run) {
          runHandler = handler;
        }
        return { dispose: jest.fn() };
      }),
      createTestRun: jest.fn(() => {
        const run = { started: jest.fn(), passed: jest.fn(), failed: jest.fn(), skipped: jest.fn(), errored: jest.fn(), appendOutput: jest.fn(), end: jest.fn() };
        createdRuns.push(run);
        return run;
      }),
      dispose: jest.fn()
    };

    (vscode.tests.createTestController as jest.Mock).mockReturnValue(controller);
    (lwcTestIndexer.findAllTestFileInfo as jest.Mock).mockResolvedValue([{ kind: 'testFile', testUri }]);
    (lwcTestIndexer.findTestInfoFromLwcJestTestFile as jest.Mock).mockResolvedValue([]);

    const { getLwcTestController } = require('../../../../src/testSupport/testExplorer/lwcTestController');
    const ctrl = getLwcTestController();
    await ctrl.refresh();

    // executeOne will be invoked; stub the shell info so the run short-circuits without spawning a task.
    jest
      .spyOn(require('../../../../src/testSupport/testRunner/testRunner').TestRunner.prototype, 'getShellExecutionInfo')
      .mockResolvedValue(undefined);

    await ctrl.runByExecutionInfo({ kind: 'testFile', testUri }, false);

    expect(controller.createTestRun).toHaveBeenCalled();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd packages/salesforcedx-vscode-lwc && npx jest test/jest/testSupport/testExplorer/lwcTestController.test.ts -t "runByExecutionInfo"`
Expected: FAIL — `ctrl.runByExecutionInfo is not a function` (and/or `getLwcTestController` not exported).

- [x] **Step 3: Write minimal implementation** — in `lwcTestController.ts`:

Promote the accessor to an export (change line ~537):

```typescript
export const getLwcTestController = (): LwcTestController => {
  instance ??= new LwcTestController();
  return instance;
};
```

Add inside the `LwcTestController` class (near `runTests`):

```typescript
/** Public entry: run (or debug) the test(s) described by `info` through the native Test Run UI. */
public runByExecutionInfo = async (info: TestExecutionInfo, isDebug: boolean): Promise<void> => {
  const item = await this.resolveItemForExecutionInfo(info);
  if (!item) {
    return;
  }
  const profile = isDebug ? this.debugProfile : this.runProfile;
  const request = new vscode.TestRunRequest([item], undefined, profile);
  const tokenSource = new vscode.CancellationTokenSource();
  try {
    await this.runTests(request, tokenSource.token, isDebug);
  } finally {
    tokenSource.dispose();
  }
};

private resolveItemForExecutionInfo = async (info: TestExecutionInfo): Promise<vscode.TestItem | undefined> => {
  const fileUri = info.testUri;
  const fileId = createFileId(fileUri);
  let fileItem = this.fileItems.get(fileId);
  if (!fileItem) {
    // discovery may not have run yet for this uri; create the item on demand
    fileItem = this.getOrCreateFileItem({ kind: 'testFile', testUri: fileUri });
  }
  if (info.kind === 'testFile' || info.kind === 'testDirectory') {
    return fileItem;
  }
  // testCase: ensure children are resolved, then match by label (== jest testName)
  await this.resolveFileChildren(fileItem);
  const targetName = isTestCaseInfo(info) ? info.testName : undefined;
  let match: vscode.TestItem | undefined;
  fileItem.children.forEach(child => {
    if (!match && child.label === targetName) {
      match = child;
    }
  });
  return match ?? fileItem;
};
```

Store profile references in `setupProfiles` so `runByExecutionInfo` can reuse them:

```typescript
private runProfile!: vscode.TestRunProfile;
private debugProfile!: vscode.TestRunProfile;

private setupProfiles = (): void => {
  this.runProfile = this.controller.createRunProfile(
    nls.localize('lwc_test_run_profile_title'),
    vscode.TestRunProfileKind.Run,
    (request, token) => this.runTests(request, token, false),
    true
  );
  this.debugProfile = this.controller.createRunProfile(
    nls.localize('lwc_test_debug_profile_title'),
    vscode.TestRunProfileKind.Debug,
    (request, token) => this.runTests(request, token, true)
  );
};
```

Add the `isTestCaseInfo` import if not present: `import { ..., isTestCaseInfo } from '../types';`

- [x] **Step 4: Run test to verify it passes**

Run: `cd packages/salesforcedx-vscode-lwc && npx jest test/jest/testSupport/testExplorer/lwcTestController.test.ts -t "runByExecutionInfo"`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/salesforcedx-vscode-lwc/src/testSupport/testExplorer/lwcTestController.ts packages/salesforcedx-vscode-lwc/test/jest/testSupport/testExplorer/lwcTestController.test.ts
git commit -m "feat(lwc): add public runByExecutionInfo on LWC test controller"
```

**✓ COMPLETED 2026-06-24** — Controller singleton + runByExecutionInfo committed.

---

### Task 2: Add convenience methods for the active editor file

**Files:**
- Modify: `packages/salesforcedx-vscode-lwc/src/testSupport/testExplorer/lwcTestController.ts`
- Test: `packages/salesforcedx-vscode-lwc/test/jest/testSupport/testExplorer/lwcTestController.test.ts`

**Interfaces:**
- Consumes: `runByExecutionInfo` (Task 1), `isLwcJestTest` from `../utils/isLwcJestTest`.
- Produces:
  - `public runActiveEditorFile = (isDebug: boolean): Promise<void> | undefined` — reads `vscode.window.activeTextEditor`, guards with `isLwcJestTest`, builds a `TestFileInfo`, calls `runByExecutionInfo`.

- [x] **Step 1: Write the failing test** — add to the public-run-API describe block. Tests 2 cases: no active editor + non-LWC-jest document.

```typescript
it('runActiveEditorFile no-ops when there is no active editor', async () => {
  const controller = {
    resolveHandler: undefined,
    refreshHandler: undefined,
    items: { replace: jest.fn(), forEach: jest.fn() },
    createTestItem: jest.fn(),
    createRunProfile: jest.fn(() => ({ dispose: jest.fn() })),
    createTestRun: jest.fn(),
    dispose: jest.fn()
  };
  (vscode.tests.createTestController as jest.Mock).mockReturnValue(controller);
  // no active editor
  (vscode.window as any).activeTextEditor = undefined;

  const { getLwcTestController } = require('../../../../src/testSupport/testExplorer/lwcTestController');
  const ctrl = getLwcTestController();
  await ctrl.runActiveEditorFile(false);

  expect(controller.createTestRun).not.toHaveBeenCalled();
});

it('runActiveEditorFile no-ops when the active editor is not an LWC jest test', async () => {
  const controller = {
    resolveHandler: undefined,
    refreshHandler: undefined,
    items: { replace: jest.fn(), forEach: jest.fn() },
    createTestItem: jest.fn(),
    createRunProfile: jest.fn(() => ({ dispose: jest.fn() })),
    createTestRun: jest.fn(),
    dispose: jest.fn()
  };
  (vscode.tests.createTestController as jest.Mock).mockReturnValue(controller);

  // active editor with a document that is NOT an LWC jest test
  const mockDocument = {
    uri: { fsPath: '/project/src/app.ts' },
    languageId: 'typescript'
  };
  (vscode.window as any).activeTextEditor = {
    document: mockDocument
  };

  // isLwcJestTest returns false for this document
  (isLwcJestTest as jest.Mock).mockReturnValue(false);

  const { getLwcTestController } = require('../../../../src/testSupport/testExplorer/lwcTestController');
  const ctrl = getLwcTestController();
  await ctrl.runActiveEditorFile(false);

  expect(controller.createTestRun).not.toHaveBeenCalled();
  expect(isLwcJestTest).toHaveBeenCalledWith(mockDocument);
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd packages/salesforcedx-vscode-lwc && npx jest test/jest/testSupport/testExplorer/lwcTestController.test.ts -t "runActiveEditorFile"`
Expected: FAIL — `ctrl.runActiveEditorFile is not a function` (or mock not defined).

- [x] **Step 3: Write minimal implementation** — add to `lwcTestController.ts`, import `isLwcJestTest`, and add a `beforeEach` to reset mocks:

In test file:
```typescript
// Mock isLwcJestTest so we can control its return value per test
jest.mock('../../../../src/testSupport/utils/isLwcJestTest', () => ({
  isLwcJestTest: jest.fn()
}));

describe('LwcTestController public run API', () => {
  beforeEach(() => {
    // Reset the isLwcJestTest mock between tests
    (isLwcJestTest as jest.Mock).mockReset();
  });
  // ... tests ...
});
```

In source file, add import + method:
```typescript
import { isLwcJestTest } from '../utils/isLwcJestTest';

/** Public entry for the editor-title button / command palette: run the active LWC test file. */
public runActiveEditorFile = (isDebug: boolean): Promise<void> | undefined => {
  const editor = vscode.window.activeTextEditor;
  if (!editor || !isLwcJestTest(editor.document)) {
    return undefined;
  }
  const info: TestFileInfo = { kind: 'testFile', testUri: editor.document.uri };
  return this.runByExecutionInfo(info, isDebug);
};
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd packages/salesforcedx-vscode-lwc && npx jest test/jest/testSupport/testExplorer/lwcTestController.test.ts -t "runActiveEditorFile"`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/salesforcedx-vscode-lwc/src/testSupport/testExplorer/lwcTestController.ts packages/salesforcedx-vscode-lwc/test/jest/testSupport/testExplorer/lwcTestController.test.ts
git commit -m "feat(lwc): add runActiveEditorFile convenience method"
```

**✓ COMPLETED 2026-06-24** — Both test + implementation committed.

---

### Task 3: Repoint the RUN command handlers at the controller

**Files:**
- Modify: `packages/salesforcedx-vscode-lwc/src/testSupport/commands/lwcTestRunAction.ts`
- Test: `packages/salesforcedx-vscode-lwc/test/jest/testSupport/commands/lwcTestRunAction.test.ts` (new)

**Interfaces:**
- Consumes: `getLwcTestController` (Task 1), `runActiveEditorFile` (Task 2), `runByExecutionInfo` (Task 1).
- Produces (unchanged exported names, so `commands/index.ts` needs no edit):
  - `lwcTestCaseRun(data: { testExecutionInfo: TestExecutionInfo })`
  - `lwcTestFileRun(data: { testExecutionInfo: TestExecutionInfo })`
  - `lwcTestRunActiveTextEditorTest()`

- [ ] **Step 1: Write the failing test** — create `test/jest/testSupport/commands/lwcTestRunAction.test.ts`.

```typescript
/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { URI } from 'vscode-uri';

const runByExecutionInfo = jest.fn();
const runActiveEditorFile = jest.fn();

jest.mock('../../../../src/testSupport/testExplorer/lwcTestController', () => ({
  getLwcTestController: () => ({ runByExecutionInfo, runActiveEditorFile })
}));

import { lwcTestFileRun, lwcTestCaseRun } from '../../../../src/testSupport/commands/lwcTestRunAction';

describe('lwcTestRunAction routes through the controller', () => {
  beforeEach(() => {
    runByExecutionInfo.mockClear();
    runActiveEditorFile.mockClear();
  });

  it('lwcTestFileRun calls controller.runByExecutionInfo with isDebug=false', () => {
    const testExecutionInfo = { kind: 'testFile', testUri: URI.file('/a/foo.test.js') };
    lwcTestFileRun({ testExecutionInfo });
    expect(runByExecutionInfo).toHaveBeenCalledWith(testExecutionInfo, false);
  });

  it('lwcTestCaseRun calls controller.runByExecutionInfo with isDebug=false', () => {
    const testExecutionInfo = { kind: 'testCase', testUri: URI.file('/a/foo.test.js'), testName: 'does x' };
    lwcTestCaseRun({ testExecutionInfo });
    expect(runByExecutionInfo).toHaveBeenCalledWith(testExecutionInfo, false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/salesforcedx-vscode-lwc && npx jest test/jest/testSupport/commands/lwcTestRunAction.test.ts`
Expected: FAIL — current implementation calls `TestRunner`/`executeAsSfTask`, not `runByExecutionInfo`.

- [ ] **Step 3: Write minimal implementation** — replace the body of `lwcTestRunAction.ts`:

```typescript
/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { getLwcTestController } from '../testExplorer/lwcTestController';
import { TestExecutionInfo } from '../types';

/** Run an individual test case (code lens). */
export const lwcTestCaseRun = (data: { testExecutionInfo: TestExecutionInfo }) =>
  getLwcTestController().runByExecutionInfo(data.testExecutionInfo, false);

/** Run a test file (command palette / test explorer node). */
export const lwcTestFileRun = (data: { testExecutionInfo: TestExecutionInfo }) =>
  getLwcTestController().runByExecutionInfo(data.testExecutionInfo, false);

/** Run the test of the currently focused editor (editor-title play button). */
export const lwcTestRunActiveTextEditorTest = () => getLwcTestController().runActiveEditorFile(false);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/salesforcedx-vscode-lwc && npx jest test/jest/testSupport/commands/lwcTestRunAction.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/salesforcedx-vscode-lwc/src/testSupport/commands/lwcTestRunAction.ts packages/salesforcedx-vscode-lwc/test/jest/testSupport/commands/lwcTestRunAction.test.ts
git commit -m "feat(lwc): route LWC test run commands through the test controller"
```

---

### Task 4: Repoint the DEBUG command handlers at the controller

**Files:**
- Modify: `packages/salesforcedx-vscode-lwc/src/testSupport/commands/lwcTestDebugAction.ts`
- Test: `packages/salesforcedx-vscode-lwc/test/jest/testSupport/commands/lwcTestDebugAction.test.ts` (new)

**Interfaces:**
- Consumes: `getLwcTestController().runByExecutionInfo` / `runActiveEditorFile` (Tasks 1-2). The controller's `executeOne` already launches `vscode.debug.startDebugging` for `isDebug === true`.
- Produces (unchanged names): `lwcTestCaseDebug`, `lwcTestFileDebug`, `lwcTestDebugActiveTextEditorTest`. KEEP `handleDidStartDebugSession`, `handleDidTerminateDebugSession` (telemetry) exactly as-is.

**Note on telemetry:** the controller's debug path sets `sfDebugSessionId` in its `vscode.debug.startDebugging` config (see `lwcTestController.executeOne`), and `handleDidStart/TerminateDebugSession` key off `sfDebugSessionId`, so debug telemetry continues to fire. Verify this id is present in the controller config (it is: `sfDebugSessionId: globalThis.crypto.randomUUID()` in `executeOne`).

- [ ] **Step 1: Write the failing test** — create `lwcTestDebugAction.test.ts`.

```typescript
/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { URI } from 'vscode-uri';

const runByExecutionInfo = jest.fn();
const runActiveEditorFile = jest.fn();

jest.mock('../../../../src/testSupport/testExplorer/lwcTestController', () => ({
  getLwcTestController: () => ({ runByExecutionInfo, runActiveEditorFile })
}));

import { lwcTestFileDebug, lwcTestCaseDebug } from '../../../../src/testSupport/commands/lwcTestDebugAction';

describe('lwcTestDebugAction routes through the controller', () => {
  beforeEach(() => {
    runByExecutionInfo.mockClear();
  });

  it('lwcTestFileDebug calls controller.runByExecutionInfo with isDebug=true', async () => {
    const testExecutionInfo = { kind: 'testFile', testUri: URI.file('/a/foo.test.js') };
    await lwcTestFileDebug({ testExecutionInfo });
    expect(runByExecutionInfo).toHaveBeenCalledWith(testExecutionInfo, true);
  });

  it('lwcTestCaseDebug calls controller.runByExecutionInfo with isDebug=true', async () => {
    const testExecutionInfo = { kind: 'testCase', testUri: URI.file('/a/foo.test.js'), testName: 'does x' };
    await lwcTestCaseDebug({ testExecutionInfo });
    expect(runByExecutionInfo).toHaveBeenCalledWith(testExecutionInfo, true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/salesforcedx-vscode-lwc && npx jest test/jest/testSupport/commands/lwcTestDebugAction.test.ts`
Expected: FAIL — current code builds a debug config via `TestRunner`, not `runByExecutionInfo`.

- [ ] **Step 3: Write minimal implementation** — replace the run-routing functions in `lwcTestDebugAction.ts`, KEEPING the two session handlers and the telemetry imports they use:

```typescript
/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { telemetryService } from '../../telemetry';
import { getLwcTestController } from '../testExplorer/lwcTestController';
import { TestCaseInfo, TestExecutionInfo } from '../types';
import { LWC_TEST_DEBUG_LOG_NAME } from '../types/constants';
import { workspaceService } from '../workspace/workspaceService';

const debugSessionStartTimes = new Map<string, number>();

/** Debug an individual test case (code lens). */
export const lwcTestCaseDebug = (data: { testExecutionInfo: TestCaseInfo }) =>
  getLwcTestController().runByExecutionInfo(data.testExecutionInfo, true);

/** Debug a test file (test explorer node). */
export const lwcTestFileDebug = (data: { testExecutionInfo: TestExecutionInfo }) =>
  getLwcTestController().runByExecutionInfo(data.testExecutionInfo, true);

/** Debug the test of the currently focused editor (editor-title debug button). */
export const lwcTestDebugActiveTextEditorTest = () => getLwcTestController().runActiveEditorFile(true);

export const handleDidStartDebugSession = (session: vscode.DebugSession) => {
  const { sfDebugSessionId } = session.configuration;
  if (typeof sfDebugSessionId === 'string') {
    debugSessionStartTimes.set(sfDebugSessionId, globalThis.performance.now());
  }
};

export const handleDidTerminateDebugSession = (session: vscode.DebugSession) => {
  const { sfDebugSessionId } = session.configuration;
  const startTime = typeof sfDebugSessionId === 'string' ? debugSessionStartTimes.get(sfDebugSessionId) : undefined;
  if (typeof startTime === 'number') {
    telemetryService.sendEventData(
      LWC_TEST_DEBUG_LOG_NAME,
      { workspaceType: workspaceService.getCurrentWorkspaceTypeForTelemetry() },
      { executionTime: globalThis.performance.now() - startTime }
    );
  }
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/salesforcedx-vscode-lwc && npx jest test/jest/testSupport/commands/lwcTestDebugAction.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/salesforcedx-vscode-lwc/src/testSupport/commands/lwcTestDebugAction.ts packages/salesforcedx-vscode-lwc/test/jest/testSupport/commands/lwcTestDebugAction.test.ts
git commit -m "feat(lwc): route LWC test debug commands through the test controller"
```

---

### Task 5: Add a native Continuous Run profile to the controller (watch backbone)

> **DEFERRED — follow-up WI.** Not executed in this branch. Retained as the follow-up seed. Watch-scope decision (test file only vs. component folder) is also deferred.

**Files:**
- Modify: `packages/salesforcedx-vscode-lwc/src/testSupport/testExplorer/lwcTestController.ts`
- Test: `packages/salesforcedx-vscode-lwc/test/jest/testSupport/testExplorer/lwcTestController.test.ts`

**Interfaces:**
- Consumes: existing `runTests`/`executeOne`, `setupProfiles` (Task 1).
- Produces:
  - Run profile created with `supportsContinuousRun = true`. VS Code calls the same `runHandler` with `request.continuous === true`; when continuous, the controller registers a file watcher on the targeted files and re-runs on change, ending the run only when `token` is cancelled (the user toggles continuous off).
  - `public isWatchingUri(uri: URI): boolean` and `public toggleWatch(info: TestExecutionInfo): Promise<void>` for the editor-title start/stop buttons (Task 7 wires these).

**Design:** A native Continuous Run profile is the idiomatic replacement for the jest `--watch` task. Rather than keeping jest's own `--watch` process, the controller owns the loop: it watches the target file(s) via `vscode.workspace.createFileSystemWatcher` and calls `executeOne` per change, attributing results to TestItems. This unifies feedback (Test Results updates each run) and removes the hidden `--watch` task.

- [ ] **Step 1: Write the failing test**

```typescript
it('creates a Run profile that supports continuous run', () => {
  const profiles: any[] = [];
  const controller = {
    resolveHandler: undefined,
    refreshHandler: undefined,
    items: { replace: jest.fn(), forEach: jest.fn() },
    createTestItem: jest.fn(),
    createRunProfile: jest.fn((label, kind, handler, isDefault) => {
      const profile: any = { label, kind, handler, isDefault, supportsContinuousRun: false, dispose: jest.fn() };
      profiles.push(profile);
      return profile;
    }),
    createTestRun: jest.fn(),
    dispose: jest.fn()
  };
  (vscode.tests.createTestController as jest.Mock).mockReturnValue(controller);

  const { getLwcTestController } = require('../../../../src/testSupport/testExplorer/lwcTestController');
  getLwcTestController();

  const runProfile = profiles.find(p => p.kind === vscode.TestRunProfileKind.Run);
  expect(runProfile.supportsContinuousRun).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/salesforcedx-vscode-lwc && npx jest test/jest/testSupport/testExplorer/lwcTestController.test.ts -t "continuous run"`
Expected: FAIL — `supportsContinuousRun` stays `false`.

- [ ] **Step 3: Write minimal implementation** — in `setupProfiles`, after creating `this.runProfile`, set:

```typescript
this.runProfile.supportsContinuousRun = true;
```

And in `runTests`, branch on continuous:

```typescript
private runTests = async (
  request: vscode.TestRunRequest,
  token: vscode.CancellationToken,
  isDebug: boolean
): Promise<void> => {
  if (request.continuous) {
    return this.runContinuous(request, token);
  }
  // ... existing one-shot body unchanged ...
};

private runContinuous = async (request: vscode.TestRunRequest, token: vscode.CancellationToken): Promise<void> => {
  const targets = this.gatherTargets(request);
  const watchers: vscode.FileSystemWatcher[] = [];
  const runOnce = async () => {
    const run = this.controller.createTestRun(request);
    try {
      for (const target of targets) {
        if (token.isCancellationRequested) {
          break;
        }
        this.markRunning(run, target.item);
        await this.executeOne(run, target.exec, target.item, false, token);
      }
    } finally {
      run.end();
    }
  };
  for (const target of targets) {
    if (target.item.uri) {
      const watcher = vscode.workspace.createFileSystemWatcher(target.item.uri.fsPath);
      watcher.onDidChange(() => void runOnce());
      watchers.push(watcher);
    }
  }
  await runOnce();
  await new Promise<void>(resolve => token.onCancellationRequested(() => resolve()));
  watchers.forEach(w => w.dispose());
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/salesforcedx-vscode-lwc && npx jest test/jest/testSupport/testExplorer/lwcTestController.test.ts -t "continuous run"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/salesforcedx-vscode-lwc/src/testSupport/testExplorer/lwcTestController.ts packages/salesforcedx-vscode-lwc/test/jest/testSupport/testExplorer/lwcTestController.test.ts
git commit -m "feat(lwc): add native continuous-run profile to LWC test controller"
```

---

### Task 6: Expose watch toggle state + methods for the editor-title buttons

> **DEFERRED — follow-up WI.** Not executed in this branch.

**Files:**
- Modify: `packages/salesforcedx-vscode-lwc/src/testSupport/testExplorer/lwcTestController.ts`
- Test: `packages/salesforcedx-vscode-lwc/test/jest/testSupport/testExplorer/lwcTestController.test.ts`

**Interfaces:**
- Consumes: `runContinuous` (Task 5), the watching-context constant `SF_LWC_JEST_IS_WATCHING_FOCUSED_FILE_CONTEXT` from `../types/constants`.
- Produces:
  - `public isWatchingUri = (uri: URI): boolean`
  - `public startWatching = async (info: TestExecutionInfo): Promise<void>` — starts a continuous run for `info`, tracks its `CancellationTokenSource` keyed by `fsPath`, and sets the editor-title context key.
  - `public stopWatching = (info: TestExecutionInfo): void` — cancels the tracked token and clears context.
  - `public stopWatchingAll = (): void`

- [ ] **Step 1: Write the failing test**

```typescript
it('startWatching marks the uri as watched and stopWatching clears it', async () => {
  const testUri = URI.file('/project/force-app/lwc/foo/__tests__/foo.test.js');
  const controller = {
    resolveHandler: undefined,
    refreshHandler: undefined,
    items: { replace: jest.fn(), forEach: jest.fn() },
    createTestItem: (id: string, label: string, uri?: URI) => ({
      id, label, uri, canResolveChildren: false, tags: [], children: { replace: jest.fn(), forEach: jest.fn() }
    }),
    createRunProfile: jest.fn(() => ({ supportsContinuousRun: false, dispose: jest.fn() })),
    createTestRun: jest.fn(() => ({ started: jest.fn(), passed: jest.fn(), failed: jest.fn(), skipped: jest.fn(), errored: jest.fn(), appendOutput: jest.fn(), end: jest.fn() })),
    dispose: jest.fn()
  };
  (vscode.tests.createTestController as jest.Mock).mockReturnValue(controller);
  (vscode.workspace.createFileSystemWatcher as jest.Mock) =
    jest.fn(() => ({ onDidChange: jest.fn(), dispose: jest.fn() }));
  jest
    .spyOn(require('../../../../src/testSupport/testRunner/testRunner').TestRunner.prototype, 'getShellExecutionInfo')
    .mockResolvedValue(undefined);

  const { getLwcTestController } = require('../../../../src/testSupport/testExplorer/lwcTestController');
  const ctrl = getLwcTestController();

  const info = { kind: 'testFile', testUri };
  void ctrl.startWatching(info);
  await new Promise(r => setImmediate(r));
  expect(ctrl.isWatchingUri(testUri)).toBe(true);

  ctrl.stopWatching(info);
  expect(ctrl.isWatchingUri(testUri)).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/salesforcedx-vscode-lwc && npx jest test/jest/testSupport/testExplorer/lwcTestController.test.ts -t "startWatching"`
Expected: FAIL — methods not defined.

- [ ] **Step 3: Write minimal implementation** — add to `lwcTestController.ts` (import the constant: `import { SF_LWC_JEST_IS_WATCHING_FOCUSED_FILE_CONTEXT } from '../types/constants';`):

```typescript
private readonly watchTokens = new Map<string, vscode.CancellationTokenSource>();

public isWatchingUri = (uri: URI): boolean => this.watchTokens.has(uri.fsPath);

public startWatching = async (info: TestExecutionInfo): Promise<void> => {
  const item = await this.resolveItemForExecutionInfo(info);
  if (!item) {
    return;
  }
  const tokenSource = new vscode.CancellationTokenSource();
  this.watchTokens.set(info.testUri.fsPath, tokenSource);
  this.setWatchingContext(info.testUri);
  const request = new vscode.TestRunRequest([item], undefined, this.runProfile, true);
  try {
    await this.runTests(request, tokenSource.token, false);
  } finally {
    this.watchTokens.delete(info.testUri.fsPath);
    this.setWatchingContext(info.testUri);
  }
};

public stopWatching = (info: TestExecutionInfo): void => {
  const source = this.watchTokens.get(info.testUri.fsPath);
  source?.cancel();
  source?.dispose();
  this.watchTokens.delete(info.testUri.fsPath);
  this.setWatchingContext(info.testUri);
};

public stopWatchingAll = (): void => {
  for (const [fsPath, source] of this.watchTokens.entries()) {
    source.cancel();
    source.dispose();
    this.setWatchingContext(URI.file(fsPath));
  }
  this.watchTokens.clear();
};

private setWatchingContext = (uri: URI): void => {
  if (vscode.window.activeTextEditor?.document.uri.fsPath === uri.fsPath) {
    void vscode.commands.executeCommand(
      'setContext',
      SF_LWC_JEST_IS_WATCHING_FOCUSED_FILE_CONTEXT,
      this.isWatchingUri(uri)
    );
  }
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/salesforcedx-vscode-lwc && npx jest test/jest/testSupport/testExplorer/lwcTestController.test.ts -t "startWatching"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/salesforcedx-vscode-lwc/src/testSupport/testExplorer/lwcTestController.ts packages/salesforcedx-vscode-lwc/test/jest/testSupport/testExplorer/lwcTestController.test.ts
git commit -m "feat(lwc): expose watch toggle on LWC test controller"
```

---

### Task 7: Repoint the WATCH command handlers; delete the old TestWatcher

> **DEFERRED — follow-up WI.** Not executed in this branch. Watch handlers and `TestWatcher` stay as-is here.

**Files:**
- Modify: `packages/salesforcedx-vscode-lwc/src/testSupport/commands/lwcTestWatchAction.ts`
- Delete: `packages/salesforcedx-vscode-lwc/src/testSupport/testRunner/testWatcher.ts`
- Test: `packages/salesforcedx-vscode-lwc/test/jest/testSupport/commands/lwcTestWatchAction.test.ts` (new)
- Grep: confirm no other importers of `testWatcher`.

**Interfaces:**
- Consumes: `getLwcTestController().startWatching/stopWatching/stopWatchingAll` (Task 6).
- Produces (unchanged names): `lwcTestStartWatchingCurrentFile`, `lwcTestStopWatchingCurrentFile`, `lwcTestStopWatchingAllTests`.

- [ ] **Step 1: Write the failing test** — create `lwcTestWatchAction.test.ts`.

```typescript
/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';

const startWatching = jest.fn();
const stopWatching = jest.fn();
const stopWatchingAll = jest.fn();

jest.mock('../../../../src/testSupport/testExplorer/lwcTestController', () => ({
  getLwcTestController: () => ({ startWatching, stopWatching, stopWatchingAll })
}));
jest.mock('../../../../src/testSupport/utils/isLwcJestTest', () => ({ isLwcJestTest: () => true }));

import {
  lwcTestStartWatchingCurrentFile,
  lwcTestStopWatchingAllTests
} from '../../../../src/testSupport/commands/lwcTestWatchAction';

describe('lwcTestWatchAction routes through the controller', () => {
  beforeEach(() => {
    startWatching.mockClear();
    stopWatchingAll.mockClear();
  });

  it('start watching current file delegates to controller.startWatching', () => {
    (vscode.window as any).activeTextEditor = { document: { uri: URI.file('/a/foo.test.js') } };
    lwcTestStartWatchingCurrentFile();
    expect(startWatching).toHaveBeenCalledWith({ kind: 'testFile', testUri: URI.file('/a/foo.test.js') });
  });

  it('stop watching all delegates to controller.stopWatchingAll', () => {
    lwcTestStopWatchingAllTests();
    expect(stopWatchingAll).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/salesforcedx-vscode-lwc && npx jest test/jest/testSupport/commands/lwcTestWatchAction.test.ts`
Expected: FAIL — current handlers call `testWatcher`.

- [ ] **Step 3: Write minimal implementation** — replace `lwcTestWatchAction.ts`:

```typescript
/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { getLwcTestController } from '../testExplorer/lwcTestController';
import { TestFileInfo } from '../types';
import { isLwcJestTest } from '../utils/isLwcJestTest';

const getCurrentFileTestInfo = (): TestFileInfo | undefined => {
  const editor = vscode.window.activeTextEditor;
  if (editor && isLwcJestTest(editor.document)) {
    return { kind: 'testFile', testUri: editor.document.uri };
  }
};

export const lwcTestStartWatchingCurrentFile = () => {
  const info = getCurrentFileTestInfo();
  return info ? getLwcTestController().startWatching(info) : undefined;
};

export const lwcTestStopWatchingCurrentFile = () => {
  const info = getCurrentFileTestInfo();
  return info ? getLwcTestController().stopWatching(info) : undefined;
};

export const lwcTestStopWatchingAllTests = () => getLwcTestController().stopWatchingAll();
```

- [ ] **Step 4: Delete the old watcher + verify no importers**

Run: `cd packages/salesforcedx-vscode-lwc && grep -rn "testWatcher\|testRunner/testWatcher" src/ test/ || echo "no importers"`
Expected: only matches inside the file being deleted (if any) — otherwise "no importers". Then:

```bash
git rm packages/salesforcedx-vscode-lwc/src/testSupport/testRunner/testWatcher.ts
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/salesforcedx-vscode-lwc && npx jest test/jest/testSupport/commands/lwcTestWatchAction.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/salesforcedx-vscode-lwc/src/testSupport/commands/lwcTestWatchAction.ts packages/salesforcedx-vscode-lwc/test/jest/testSupport/commands/lwcTestWatchAction.test.ts
git commit -m "feat(lwc): route LWC test watch commands through continuous run; remove TestWatcher"
```

---

### Task 8: Confirm the out-of-band results listener + bare-task path stay (watch still needs them)

> **Re-scoped 2026-06-24.** Because watch mode is deferred, `executeAsSfTask` and the out-of-band results listener must REMAIN in this branch — watch runs (`TestWatcher.watchTest` → `executeAsSfTask`) still produce out-of-band Jest results that the `onDidUpdateTestResultsIndex` listener surfaces in Test Explorer. Removing them now would break watch feedback. This task is a verification gate, not a removal.

**Files:** none modified.

- [ ] **Step 1: Confirm `executeAsSfTask` still has a watch caller**

Run: `cd packages/salesforcedx-vscode-lwc && grep -rn "executeAsSfTask" src/`
Expected: definition in `testRunner.ts` + caller in `testRunner/testWatcher.ts`. (Run/debug command callers are gone after Tasks 3-4; the watcher caller remains.) If the only match is the definition, the out-of-band listener can be removed — escalate to the reviewer, since that would mean watch no longer uses it.

- [ ] **Step 2: Confirm the out-of-band listener stays wired**

Run: `cd packages/salesforcedx-vscode-lwc && grep -n "onDidUpdateTestResultsIndex\|applyIndexerResults" src/testSupport/testExplorer/lwcTestController.ts`
Expected: both present. Leave them. The follow-up WI removes them alongside the watch cutover.

- [ ] **Step 3: No commit** (verification only).

---

### Task 9: Full verification — compile, lint, knip, full test run, manual smoke

**Files:** none (verification only). See repo `verification` skill.

- [ ] **Step 1: Type-check + lint the package**

Run: `cd packages/salesforcedx-vscode-lwc && npm run compile && npm run lint`
Expected: no errors. If `knip` runs in this package's lint chain, ensure no newly-unused exports (e.g. if `SfTask` became unused). Fix any flagged dead code.

- [ ] **Step 2: Run the package unit tests**

Run: `cd packages/salesforcedx-vscode-lwc && npm run test:unit`
Expected: PASS.

- [ ] **Step 3: Manual smoke in the Extension Host** — open `dreamhouse-lwc`, open `barcodeScanner.test.js`, and exercise each entry point. Record observed feedback:

| Entry point | Expected feedback |
| --- | --- |
| Command palette: "SFDX: Run Current Lightning Web Component Test File" | test item spins in Test Explorer; results in Test Results; no silent run |
| Editor-title play button | same as palette |
| Code lens "Run Test" on a single `it()` | that case spins + result; no reliance on a terminal being open |
| Editor-title debug / code lens "Debug Test" | debugger attaches; results attributed |
| Test Explorer run profile | unchanged behavior |
| Editor-title "Start Watching" (DEFERRED scope) | unchanged from today — still works via the old TestWatcher; out-of-band results still appear. Not regressed. |

Expected: run/debug rows show live native feedback and none shows "The test run did not record any output" / "out-of-band results". The watch row is expected to behave exactly as before this change (no regression, no improvement — that's the follow-up).

- [ ] **Step 4: Commit any verification fixups**

```bash
git add -A
git commit -m "test(lwc): verification fixups for test-run feedback cutover"
```

---

## Self-Review

**Spec coverage:**
- "no feedback from palette/editor button" → Tasks 1-3 (run path through controller).
- "code lens path" → Task 3 (`lwcTestCaseRun`).
- "use native Test Explorer tooling across all touch points" → Tasks 3, 4, 7.
- "include watch mode now" (user decision) → Tasks 5-7 (Continuous Run profile).
- "full cutover, remove bare-task path + out-of-band listener" (user decision) → Task 8.
- Debug parity → Task 4.
- Verification → Task 9.

**Placeholder scan:** No "TBD"/"add error handling"-style steps; every code step shows code; every run step shows command + expected output.

**Type consistency:** `runByExecutionInfo(info, isDebug)`, `runActiveEditorFile(isDebug)`, `startWatching(info)`/`stopWatching(info)`/`stopWatchingAll()`, `isWatchingUri(uri)`, `getLwcTestController()` are used consistently across Tasks 1-8. `TestFileInfo`/`TestCaseInfo`/`TestExecutionInfo` and `isTestCaseInfo`/`isLwcJestTest` match existing `../types` and `../utils` exports.

**Open risk flagged for execution:** Task 5's continuous-run uses a file watcher on the single target file. Jest's `--watch` also re-runs when *related source* changes; the file-watcher approach only re-runs on the test file itself. If parity with jest `--watch` (re-run on component source change) is required, broaden the watcher glob to the component folder during execution — note and decide with the reviewer.
