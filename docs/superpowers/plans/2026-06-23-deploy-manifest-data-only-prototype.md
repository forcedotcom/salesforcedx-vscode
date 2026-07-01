# Deploy-Manifest Data-Only Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the "push orchestration into services" data-only approach end-to-end on ONE flow — `sf.metadata.deploy.in.manifest` — so the live `ComponentSet`/`DeployResult` never crosses the services→metadata boundary, while channel output, Problems-panel diagnostics, result storage, and conflict-retry remain byte-for-byte equivalent.

**Architecture:** The services extension already builds the `ComponentSet` and deploys inside `MetadataDeployService.deployFromSource(spec)`. This plan (1) enriches the owned `DeployOutcome` and its `toDeployOutcome` mapper to carry everything metadata's formatters read off the live `DeployResult`; (2) adds an `{ignoreConflicts?}` option to `deployFromSource` (so metadata can run its OWN conflict pass first, then issue a clean deploy); (3) rewrites metadata's `deployManifestCommand`, `formatDeployOutput`, `getMergedDeployFailures`, `deployDiagnostics`, and `maybeStoreDeployResult` to consume the enriched owned `DeployOutcome` instead of `DeployResult`. metadata keeps all VS Code presentation; services stays headless.

**SCOPE DECISION (2026-06-23):** Conflict detection STAYS IN METADATA for this prototype and is OUT OF SCOPE for the data-only migration. metadata's conflict detection has two strategies (tracking-based + timestamp-based); the timestamp strategy is entangled with metadata-only state (`.sfdx/fileResponses` result store, `buildTimestampIndex`, settings, conflict UI tree). Porting it into services is a separate, larger design problem. For the prototype, metadata runs its existing conflict detection AS-IS on its existing path BEFORE the data-only deploy, then calls `deployFromSource(spec, {ignoreConflicts: true})`. What this prototype proves: the DEPLOY MECHANICS (build → deploy → enriched owned outcome → format/diagnostics/storage) are fully data-only — no live `DeployResult` crosses the boundary. Conflict detection's own data-only migration is deferred to a follow-up. This means the prototype's deployManifest flow may, for now, still obtain a ComponentSet for its conflict pass via the existing (deprecated) getter — that getter removal waits until conflict detection is itself migrated. Do NOT attempt to port conflict detection into services in this plan.

**Tech Stack:** TypeScript, Effect-TS, Jest, npm workspaces + Wireit. Packages: `salesforcedx-vscode-services` (owned types + services impl), `salesforcedx-vscode-metadata` (consumer).

## Global Constraints

- Owned types (`packages/salesforcedx-vscode-services/src/owned/*.ts`) MUST NOT import from `@salesforce/*`, `jsforce`, `@jsforce/*`, or `effect`. Guarded by `test/jest/owned/ownedTypes.test.ts`. The mapper file `src/owned/deployMapper.ts` is the ONE exception — it MAY import SDR (it is the adapter layer), and it is NOT an `owned/*` type module for the guard's purposes (guard excludes `*Mapper.ts` — verify the guard's glob; if it does not exclude mappers, the mapper already imports SDR today and the guard already passes, so match the existing arrangement).
- Owned types are authored as `type` aliases with `readonly` members (NOT `interface`), per project eslint (`consistent-type-definitions` / `prefer-property-signatures`). Match the existing style in `src/owned/deploy.ts`.
- Use npm scripts (`npm run compile`, `npm run lint`, `npm test`) — NOT raw `npx` — so wireit applies the correct tsconfig.
- The services boundary must NOT loan live `@salesforce/source-deploy-retrieve` `ComponentSet` or `DeployResult` instances. After this plan, the deployManifest flow touches neither across the boundary.
- The deprecated getters (`deploy`, `getComponentSetFromManifest`, etc.) remain in place (deprecated) — this plan does NOT remove them (that is Phase E). It only stops the deployManifest flow from using them.
- Channel output text, Problems-panel diagnostics (file/line/column/severity/message), result-storage JSON, and conflict-retry behavior MUST remain equivalent to current behavior. Existing metadata tests for these are the regression gate.
- Branch: `phale/W-22419571-services-data-only`. Do NOT switch/create branches.

---

## File Structure

**Services package (`salesforcedx-vscode-services`):**
- `src/owned/deploy.ts` — MODIFY: enrich `FileResponseInfo` (add `lineNumber?`, `columnNumber?`, `problemType?`) and `DeployOutcome` (add `completedDate?`, `componentFailures`, and a `componentStates` classification or keep state on FileResponseInfo). Add `DeployConflict` + `DeployConflictsError`-shaped owned data and an `ignoreConflicts` option type for the deploy path.
- `src/owned/deployMapper.ts` — MODIFY: map the new fields from `DeployResult`/`DeployMessage`/`FileResponse`.
- `src/core/metadataDeployService.ts` — MODIFY: `deployFromSource(spec, opts?)` runs conflict detection (unless `opts.ignoreConflicts`) and fails with owned conflict data when conflicts exist.
- `src/contract.ts` / `src/plainApi.ts` — MODIFY: `deployFromSource` gains the optional `opts` parameter; expose component-state/classification helpers needed by metadata's formatter as owned data on the outcome (so metadata does not need `getComponentState`/`isSDRSuccess` on a live result).
- `test/jest/owned/ownedTypes.test.ts` — VERIFY still green (no new imports leak into owned types).
- `test/.../metadataDeployService` + `deployMapper` tests — MODIFY/ADD.

**Metadata package (`salesforcedx-vscode-metadata`):**
- `src/commands/deployManifest.ts` — MODIFY: call `deployFromSource({kind:'manifest', manifestUri}, {ignoreConflicts})`; conflict-retry re-issues the spec.
- `src/shared/deploy/deployComponentSet.ts` — MODIFY (or add a sibling `deployFromSpec.ts`): accept a `DeployOutcome` / orchestrate via `deployFromSource`, not a `NonEmptyComponentSet`.
- `src/shared/deploy/formatDeployOutput.ts` — MODIFY: consume owned `DeployOutcome`, not `DeployResult`.
- `src/shared/deploy/getMergedDeployFailures.ts` — MODIFY: consume owned `DeployOutcome`.
- `src/shared/deploy/deployDiagnostics.ts` — MODIFY: `applyDeployDiagnostics` consumes owned failure shape.
- `src/conflict/resultStorage.ts` — MODIFY: `maybeStoreDeployResult` consumes owned `DeployOutcome`.
- `src/conflict/conflictFlow.ts` / `conflictErrors.ts` — MODIFY: conflict-retry no longer carries a `componentSet`; carries the spec (or the command re-builds it).
- Corresponding metadata tests — MODIFY.

---

### Task 1: Enrich owned `DeployOutcome` and `FileResponseInfo`

**Files:**
- Modify: `packages/salesforcedx-vscode-services/src/owned/deploy.ts`
- Test: `packages/salesforcedx-vscode-services/test/jest/owned/ownedTypes.test.ts` (verify still green)

**Interfaces:**
- Consumes: nothing (leaf owned types).
- Produces: enriched `FileResponseInfo` and `DeployOutcome` consumed by Task 2 (mapper) and Tasks 7–11 (metadata formatters). Exact shapes below — later tasks reference these names verbatim.

- [ ] **Step 1: Read the current file to anchor the edit**

Run: open `packages/salesforcedx-vscode-services/src/owned/deploy.ts`. Current `FileResponseInfo` = `{fullName, type, state, filePath?, error?}`; `DeployOutcome` = `{success, status, fileResponses}`.

- [ ] **Step 2: Replace `FileResponseInfo` and `DeployOutcome` with enriched versions**

Edit `src/owned/deploy.ts` — replace the existing `FileResponseInfo` and `DeployOutcome` type blocks with:

```ts
export type FileResponseInfo = {
  readonly fullName: string;
  readonly type: string;
  /** SDR file state, e.g. 'Created' | 'Changed' | 'Unchanged' | 'Deleted' | 'Failed'. */
  readonly state: string;
  readonly filePath?: string;
  readonly error?: string;
  /** 1-based line of a failure, when the org reported one (drives Problems-panel range). */
  readonly lineNumber?: number;
  /** 1-based column of a failure, when the org reported one. */
  readonly columnNumber?: number;
  /** SDR problemType, e.g. 'Error' | 'Warning'. Absent for successes. */
  readonly problemType?: string;
};

/** One server-reported component failure not already present as a FileResponse failure. */
export type ComponentFailureInfo = {
  readonly fullName: string;
  readonly type: string;
  readonly problem: string;
  readonly problemType: string;
};

export type DeployOutcome = {
  readonly success: boolean;
  /** SDR RequestStatus as a string, e.g. 'Succeeded' | 'SucceededPartial' | 'Failed' | 'Canceled'. */
  readonly status: string;
  /** True when the org applied at least part of the deploy (status Succeeded or SucceededPartial). */
  readonly appliedToOrg: boolean;
  /** ISO-8601 server completedDate when present (used for result-storage timestamps). */
  readonly completedDate?: string;
  readonly fileResponses: readonly FileResponseInfo[];
  /** Server-level component failures from response.details.componentFailures, normalized. */
  readonly componentFailures: readonly ComponentFailureInfo[];
};
```

- [ ] **Step 3: Run the owned-types guard to confirm no foreign imports leaked**

Run: `cd packages/salesforcedx-vscode-services && npm test -- ownedTypes`
Expected: PASS (deploy.ts still imports nothing).

- [ ] **Step 4: Compile the services package**

Run: `cd packages/salesforcedx-vscode-services && npm run compile`
Expected: This WILL fail in `deployMapper.ts` (missing `appliedToOrg`/`componentFailures`) — that is fixed in Task 2. If it fails ONLY there, proceed. If it fails elsewhere, note it for Task 2's brief. (This is an enrich-then-wire sequence; a transient compile break between Task 1 and 2 is expected.)

- [ ] **Step 5: Commit**

```bash
git add packages/salesforcedx-vscode-services/src/owned/deploy.ts
git commit -m "feat(services): enrich owned DeployOutcome with appliedToOrg, failures, file diagnostics - W-22419571"
```

---

### Task 2: Map the enriched fields in `toDeployOutcome`

**Files:**
- Modify: `packages/salesforcedx-vscode-services/src/owned/deployMapper.ts`
- Test: `packages/salesforcedx-vscode-services/test/jest/owned/deployMapper.test.ts` (create if absent)

**Interfaces:**
- Consumes: `FileResponseInfo`, `ComponentFailureInfo`, `DeployOutcome` from Task 1; SDR `DeployResult`, `DeployMessage`, `FileResponse`, `RequestStatus`.
- Produces: `toDeployOutcome(result: DeployResult): DeployOutcome` filling every new field. Consumed by Task 3 and the metadata formatters.

- [ ] **Step 1: Write the failing test**

Create `packages/salesforcedx-vscode-services/test/jest/owned/deployMapper.test.ts`:

```ts
import { toDeployOutcome } from '../../../src/owned/deployMapper';

// Minimal DeployResult-shaped fake; cast through unknown since we only exercise mapper reads.
const makeResult = (overrides: Record<string, unknown>) =>
  ({
    response: { success: true, status: 'Succeeded', completedDate: '2026-06-23T00:00:00.000Z', details: {} },
    getFileResponses: () => [],
    ...overrides
  }) as unknown as Parameters<typeof toDeployOutcome>[0];

describe('toDeployOutcome', () => {
  it('maps appliedToOrg true for Succeeded and SucceededPartial', () => {
    expect(toDeployOutcome(makeResult({})).appliedToOrg).toBe(true);
    expect(
      toDeployOutcome(makeResult({ response: { success: false, status: 'SucceededPartial', details: {} } }))
        .appliedToOrg
    ).toBe(true);
  });

  it('maps appliedToOrg false for Failed', () => {
    expect(
      toDeployOutcome(makeResult({ response: { success: false, status: 'Failed', details: {} } })).appliedToOrg
    ).toBe(false);
  });

  it('maps completedDate through', () => {
    expect(toDeployOutcome(makeResult({})).completedDate).toBe('2026-06-23T00:00:00.000Z');
  });

  it('maps per-file failure line/column/problemType', () => {
    const result = makeResult({
      getFileResponses: () => [
        {
          fullName: 'MyClass',
          type: 'ApexClass',
          state: 'Failed',
          filePath: '/x/MyClass.cls',
          error: 'oops (3:5)',
          lineNumber: 3,
          columnNumber: 5,
          problemType: 'Error'
        }
      ]
    });
    const fr = toDeployOutcome(result).fileResponses[0];
    expect(fr).toMatchObject({ lineNumber: 3, columnNumber: 5, problemType: 'Error', error: 'oops (3:5)' });
  });

  it('normalizes response.details.componentFailures into componentFailures', () => {
    const result = makeResult({
      response: {
        success: false,
        status: 'Failed',
        details: { componentFailures: { fullName: 'A', componentType: 'ApexClass', problem: 'bad', problemType: 'Error' } }
      }
    });
    expect(toDeployOutcome(result).componentFailures).toEqual([
      { fullName: 'A', type: 'ApexClass', problem: 'bad', problemType: 'Error' }
    ]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/salesforcedx-vscode-services && npm test -- deployMapper`
Expected: FAIL (mapper does not yet set `appliedToOrg`/`completedDate`/line/col/`componentFailures`).

- [ ] **Step 3: Rewrite `toDeployOutcome` (and `mapFileResponse`) to fill the new fields**

Edit `src/owned/deployMapper.ts`. Replace `mapFileResponse` and `toDeployOutcome` with:

```ts
import { RequestStatus } from '@salesforce/source-deploy-retrieve';
import type { DeployResult, RetrieveResult, FileResponse, DeployMessage } from '@salesforce/source-deploy-retrieve';
import type { DeployOutcome, RetrieveOutcome, FileResponseInfo, ComponentFailureInfo } from './deploy';

const mapFileResponse = (fr: FileResponse): FileResponseInfo => ({
  fullName: fr.fullName,
  type: fr.type,
  state: fr.state,
  filePath: 'filePath' in fr ? fr.filePath : undefined,
  error: 'error' in fr ? fr.error : undefined,
  lineNumber: 'lineNumber' in fr ? fr.lineNumber : undefined,
  columnNumber: 'columnNumber' in fr ? fr.columnNumber : undefined,
  problemType: 'problemType' in fr ? fr.problemType : undefined
});

const toArray = (raw: DeployMessage | DeployMessage[] | undefined): DeployMessage[] =>
  raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];

const mapComponentFailure = (m: DeployMessage): ComponentFailureInfo => ({
  fullName: m.fullName,
  type: m.componentType ?? 'UNKNOWN',
  problem: m.problem ?? 'UNKNOWN',
  problemType: m.problemType ?? 'Error'
});

// eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- RequestStatus is a string enum; comparing to its members is safe
const appliedToOrg = (status: string): boolean =>
  status === RequestStatus.Succeeded || status === RequestStatus.SucceededPartial;

export const toDeployOutcome = (result: DeployResult): DeployOutcome => ({
  success: result.response.success,
  status: result.response.status,
  appliedToOrg: appliedToOrg(result.response.status),
  completedDate: result.response.completedDate,
  fileResponses: result.getFileResponses().map(mapFileResponse),
  componentFailures: toArray(result.response.details?.componentFailures).map(mapComponentFailure)
});
```

Keep `toRetrieveOutcome` as-is for now (retrieve flow is a later rollout, not this prototype).

- [ ] **Step 4: Run to verify it passes**

Run: `cd packages/salesforcedx-vscode-services && npm test -- deployMapper`
Expected: PASS (all 5 cases).

- [ ] **Step 5: Compile + lint**

Run: `cd packages/salesforcedx-vscode-services && npm run compile && npm run lint`
Expected: 0 errors (the Task 1 transient break is now resolved).

- [ ] **Step 6: Commit**

```bash
git add packages/salesforcedx-vscode-services/src/owned/deployMapper.ts packages/salesforcedx-vscode-services/test/jest/owned/deployMapper.test.ts
git commit -m "feat(services): map enriched deploy fields in toDeployOutcome - W-22419571"
```

---

### Task 3: Add `{ignoreConflicts?}` option to `deployFromSource`

**SCOPE:** Conflict detection is OUT OF SCOPE (see the Architecture scope decision). This task ONLY adds an `{ignoreConflicts?}` option and threads it to the existing `deploy` path. Services does NOT detect conflicts; metadata keeps doing that (Task 7). Do NOT port conflict detection into services.

**Files:**
- Modify: `packages/salesforcedx-vscode-services/src/owned/deploy.ts` (add the option type)
- Modify: `packages/salesforcedx-vscode-services/src/core/metadataDeployService.ts`
- Modify: `packages/salesforcedx-vscode-services/src/contract.ts`, `src/plainApi.ts`
- Test: `packages/salesforcedx-vscode-services/test/.../metadataDeployService.test.ts`

**Interfaces:**
- Consumes: `SourceSpec`, enriched `DeployOutcome` (Task 1/2); the existing internal `componentSetService.buildComponentSet(spec)` and `deploy(components)`.
- Produces: `deployFromSource(spec: SourceSpec, opts?: DeployFromSourceOptions): DeployOutcome` where `DeployFromSourceOptions = { ignoreConflicts?: boolean }`. The option is forwarded to the underlying SDR deploy if/where the existing `deploy` path honors it; if the existing `deploy(components)` already takes no conflict flag (it deploys what it is given — SDR's `ComponentSet.deploy` does not conflict-check), then `ignoreConflicts` is currently a NO-OP passthrough at the services layer and exists so the contract is stable for when conflict detection is later migrated. Document that in a comment. Consumed by Task 7.

- [ ] **Step 1: Add the owned option type to `deploy.ts`**

Edit `src/owned/deploy.ts`, append:

```ts
/** Options for deployFromSource. ignoreConflicts is reserved: conflict detection currently
 * runs in the consumer (metadata); this flag stabilizes the contract for a future migration. */
export type DeployFromSourceOptions = { readonly ignoreConflicts?: boolean };
```

- [ ] **Step 2: Accept (and span-annotate) the option in `deployFromSource`**

Replace the current `deployFromSource` (lines ~166–171) with:

```ts
const deployFromSource = Effect.fn('MetadataDeployService.deployFromSource')(function* (
  spec: SourceSpec,
  // ignoreConflicts is reserved — services does not conflict-check today (the underlying SDR deploy
  // applies what it is given); the consumer runs conflict detection. The flag keeps the contract
  // stable for when conflict detection migrates into services.
  opts?: { ignoreConflicts?: boolean }
) {
  yield* Effect.annotateCurrentSpan({ specKind: spec.kind, ignoreConflicts: opts?.ignoreConflicts ?? false });
  const components = yield* componentSetService.buildComponentSet(spec);
  const deployResult = yield* deploy(components);
  return toDeployOutcome(deployResult);
});
```

- [ ] **Step 3: Thread the option through contract + plainApi**

In `src/contract.ts`, change line ~115:
```ts
readonly deployFromSource: (spec: SourceSpec, opts?: DeployFromSourceOptions) => DeployOutcome;
```
Add `DeployFromSourceOptions` to the import from `./owned/deploy` at the top of `contract.ts`.

In `src/plainApi.ts`, change the `deployFromSource` impl (lines ~265–266):
```ts
deployFromSource: (spec: import('./owned/deploy').SourceSpec, opts?: import('./owned/deploy').DeployFromSourceOptions) =>
  run(builtContext, MetadataDeployService.deployFromSource(spec, opts)),
```

- [ ] **Step 4: Test — the option is accepted and deploy still maps to the enriched outcome**

Add to the metadataDeployService test (mirror the existing test harness; mock `componentSetService.buildComponentSet` to return a fake set and `deploy` to return a fake DeployResult):
```ts
it('deployFromSource accepts ignoreConflicts and returns an enriched DeployOutcome', /* assert outcome.appliedToOrg / componentFailures present */);
it('deployFromSource defaults (no opts) still returns the enriched DeployOutcome', /* ... */);
```
Run: `cd packages/salesforcedx-vscode-services && npm test -- metadataDeployService`
Expected: PASS.

- [ ] **Step 5: Compile + lint + full services tests**

Run: `cd packages/salesforcedx-vscode-services && npm run compile && npm run lint && npm test`
Expected: 0 errors; all green.

- [ ] **Step 6: Commit**

```bash
git add packages/salesforcedx-vscode-services/src
git commit -m "feat(services): deployFromSource accepts ignoreConflicts option (reserved) - W-22419571"
```

---

### Task 4: Rewrite `formatDeployOutput` to consume owned `DeployOutcome`

**Files:**
- Modify: `packages/salesforcedx-vscode-metadata/src/shared/deploy/formatDeployOutput.ts`
- Modify: `packages/salesforcedx-vscode-metadata/src/shared/deploy/getMergedDeployFailures.ts`
- Test: existing metadata formatDeployOutput tests

**Interfaces:**
- Consumes: enriched `DeployOutcome` from services (`appliedToOrg`, `status`, `fileResponses[state/type/filePath/error/lineNumber/columnNumber/problemType]`, `componentFailures`).
- Produces: `formatDeployOutput(outcome: DeployOutcome): Effect<string>` and `getMergedDeployFailures(outcome: DeployOutcome): Effect<readonly FileResponseInfo[]>` (returns owned failures, not SDR `FileResponseFailure`). Consumed by Task 7's `deployComponentSet` replacement.

- [ ] **Step 1: Establish current behavior as the test baseline**

Run the existing format tests: `cd packages/salesforcedx-vscode-metadata && npm test -- formatDeployOutput`
Record the expected output strings (they assert the `=== Deployed Source (N) ===` sections). These exact strings MUST be preserved.

- [ ] **Step 2: Rewrite `getMergedDeployFailures` to take a `DeployOutcome`**

Replace the body to merge `outcome.fileResponses.filter(state==='Failed')` with `outcome.componentFailures` (dedupe by `type#fullName`, same logic as today). Return owned `FileResponseInfo[]`-shaped failures (synthesize `FileResponseInfo` from `componentFailures` extras: `{fullName, type, state:'Failed', error: problem, problemType, filePath: undefined}`). Remove the `ExtensionProviderService`/`isSDRFailure`/`makeFileResponseFailure` calls — failures are now identified by `state === 'Failed'` on owned data.

```ts
import type { DeployOutcome, FileResponseInfo } from 'salesforcedx-vscode-services'; // owned type re-export — verify export path
const makeKey = (type: string, name: string) => `${type}#${name}`;

export const getMergedDeployFailures = (outcome: DeployOutcome): readonly FileResponseInfo[] => {
  const failures = outcome.fileResponses.filter(fr => fr.state === 'Failed');
  if (outcome.componentFailures.length <= failures.length) return failures;
  const seen = new Set(failures.map(f => makeKey(f.type, f.fullName)));
  const extras = outcome.componentFailures
    .filter(m => !seen.has(makeKey(m.type, m.fullName)))
    .map((m): FileResponseInfo => ({ fullName: m.fullName, type: m.type, state: 'Failed', error: m.problem, problemType: m.problemType }));
  return [...failures, ...extras];
};
```
NOTE: this is now pure (no Effect) — update the call site accordingly (Task 7). If the owned `DeployOutcome`/`FileResponseInfo` types are not yet re-exported from the `salesforcedx-vscode-services` package entry, add the re-export in `src/index.ts` of the services package (they should be — verify; if missing, add `export type { DeployOutcome, FileResponseInfo, ComponentFailureInfo } from './owned/deploy';`). Fold that re-export into THIS task.

- [ ] **Step 3: Rewrite `formatDeployOutput` to consume `DeployOutcome`**

Replace `DeployResult` param with `outcome: DeployOutcome`. Map:
- `deployAppliedToOrg(result)` → `outcome.appliedToOrg` (the field; delete the local helper).
- `result.getFileResponses().filter(isSDRSuccess)` → `outcome.fileResponses.filter(fr => fr.state !== 'Failed')`.
- component-state classification `getComponentState(fr)` → derive from `fr.state`: `'Deleted'` → `'deleted'`, else `'deploys'` grouping is `state === 'Deleted' ? 'deleted' : 'deploys'`. (The current `notDeployedOutcomeLabel` switch keys on `'created'|'changed'|'unchanged'|'deleted'`; map `fr.state` lowercased: `'Created'→'created'`, `'Changed'→'changed'`, `'Unchanged'→'unchanged'`, `'Deleted'→'deleted'`. Add a small local `stateToChange(state: string)` returning that union, defaulting `'changed'` for unknowns.)
- `failed` from `getMergedDeployFailures(outcome)` (now sync).
- Keep all section strings identical.

Provide the full rewritten file in the implementation (the engineer writes it out completely; do not leave `getComponentState` calls — they referenced the live result).

- [ ] **Step 4: Run format tests**

Run: `cd packages/salesforcedx-vscode-metadata && npm test -- formatDeployOutput`
Expected: PASS with identical output strings. Update test inputs to construct owned `DeployOutcome` fixtures instead of SDR `DeployResult` fixtures; assertions on output text stay the same.

- [ ] **Step 5: Commit**

```bash
git add packages/salesforcedx-vscode-metadata/src/shared/deploy/formatDeployOutput.ts packages/salesforcedx-vscode-metadata/src/shared/deploy/getMergedDeployFailures.ts packages/salesforcedx-vscode-services/src/index.ts
git commit -m "refactor(metadata): formatDeployOutput consumes owned DeployOutcome - W-22419571"
```

---

### Task 5: Rewrite `applyDeployDiagnostics` to consume owned failures

**Files:**
- Modify: `packages/salesforcedx-vscode-metadata/src/shared/deploy/deployDiagnostics.ts`
- Test: existing deployDiagnostics tests (if any; else add one)

**Interfaces:**
- Consumes: owned `FileResponseInfo[]` failures (with `filePath?`, `lineNumber?`, `columnNumber?`, `error?`, `problemType?`, `type`).
- Produces: `applyDeployDiagnostics(failedResponses: readonly FileResponseInfo[]): Effect<void>`. Consumed by Task 7.

- [ ] **Step 1: Change the parameter type**

In `deployDiagnostics.ts`, replace `import type { FileResponseFailure } from '@salesforce/source-deploy-retrieve'` with the owned `FileResponseInfo` (from `salesforcedx-vscode-services`). Change `applyDeployDiagnostics(failedResponses: FileResponseFailure[])` → `(failedResponses: readonly FileResponseInfo[])`. The body already reads `{ lineNumber, columnNumber, error, problemType, type, filePath }` — all present on `FileResponseInfo`. No logic change beyond the type.

- [ ] **Step 2: Compile**

Run: `cd packages/salesforcedx-vscode-metadata && npm run compile`
Expected: This file compiles; call site in `deployComponentSet.ts` still passes the old shape (fixed in Task 7) — a transient break there is acceptable until Task 7.

- [ ] **Step 3: Run diagnostics test (if present) / add minimal one**

If a test exists, update its fixtures to owned `FileResponseInfo`. Else add a focused test asserting a failure with `lineNumber:3, columnNumber:5` produces a diagnostic at range (2,4)→(2,4) (0-based) with the error message run through `fixupError`.
Run: `cd packages/salesforcedx-vscode-metadata && npm test -- deployDiagnostics`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/salesforcedx-vscode-metadata/src/shared/deploy/deployDiagnostics.ts
git commit -m "refactor(metadata): applyDeployDiagnostics consumes owned FileResponseInfo - W-22419571"
```

---

### Task 6: Rewrite `maybeStoreDeployResult` to consume owned `DeployOutcome`

**Files:**
- Modify: `packages/salesforcedx-vscode-metadata/src/conflict/resultStorage.ts`
- Test: existing resultStorage tests

**Interfaces:**
- Consumes: owned `DeployOutcome` (`status`, `completedDate?`, `fileResponses[type, fullName]`).
- Produces: `maybeStoreDeployResult(outcome: DeployOutcome): Effect<void>`. Consumed by Task 7.

- [ ] **Step 1: Change `maybeStoreDeployResult` to read the outcome**

Replace its `DeployResult` usage:
- `isSucceeded(result.response?.status)` → `isSucceeded(outcome.status)` (the local `isSucceeded(status)` already takes a string).
- `result.response?.completedDate` → `outcome.completedDate`.
- `result.getFileResponses().map(fr => toStoredComponent(fr.type, fr.fullName, ...))` → `outcome.fileResponses.map(fr => toStoredComponent(fr.type, fr.fullName, ...))`.
- Change the import: drop `DeployResult` from the SDR type import (keep `RetrieveResult` — `maybeStoreRetrieveResult` is unchanged in this prototype). Import owned `DeployOutcome` from `salesforcedx-vscode-services`.

- [ ] **Step 2: Run resultStorage tests**

Run: `cd packages/salesforcedx-vscode-metadata && npm test -- resultStorage`
Expected: PASS after updating the deploy-side test fixture to an owned `DeployOutcome` (retrieve-side fixtures unchanged).

- [ ] **Step 3: Commit**

```bash
git add packages/salesforcedx-vscode-metadata/src/conflict/resultStorage.ts
git commit -m "refactor(metadata): maybeStoreDeployResult consumes owned DeployOutcome - W-22419571"
```

---

### Task 7: Rewrite the deployManifest flow — conflict-in-metadata, deploy data-only

**SCOPE:** Conflict detection stays on metadata's EXISTING path (it still builds/uses a ComponentSet for the conflict pass via the existing getter — that getter's removal is deferred until conflict detection itself migrates). What changes: after conflict detection passes (or is bypassed), the DEPLOY goes through the data-only `deployFromSource(spec, {ignoreConflicts:true})` and consumes the owned `DeployOutcome`. The live `DeployResult` no longer crosses the boundary.

**Files:**
- Modify: `packages/salesforcedx-vscode-metadata/src/commands/deployManifest.ts`
- Add: `packages/salesforcedx-vscode-metadata/src/shared/deploy/deployFromOutcome.ts` (NEW — outcome-consuming sibling; leaves `deployComponentSet.ts` intact for un-migrated commands)
- Test: existing deployManifest tests + new deployFromOutcome test

**Interfaces:**
- Consumes: `api.services.MetadataDeployService.deployFromSource(spec, opts)` (Task 3, Effect path); `formatDeployOutput(outcome)` (Task 4); `applyDeployDiagnostics(failures)` (Task 5); `maybeStoreDeployResult(outcome)` (Task 6); `getMergedDeployFailures(outcome)` (Task 4, now sync); the EXISTING `detectConflicts(componentSet, 'deploy')` / `handleConflictWithRetry` / `getComponentSetFromManifest` (UNCHANGED — conflict path stays as-is).
- Produces: the migrated `deployManifestCommand` (no user-visible behavior change). Leaves `deployComponentSet` untouched for the other (un-migrated) deploy commands.

- [ ] **Step 1: Create `deployFromOutcome.ts` (outcome-driven; do NOT modify `deployComponentSet.ts`)**

Create `packages/salesforcedx-vscode-metadata/src/shared/deploy/deployFromOutcome.ts`:

```ts
/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import type { DeployOutcome } from 'salesforcedx-vscode-services';
import { maybeStoreDeployResult } from '../../conflict/resultStorage';
import { nls } from '../../messages';
import { applyDeployDiagnostics, clearDeployDiagnostics } from './deployDiagnostics';
import { DeployCompletedWithErrorsError } from './deployErrors';
import { formatDeployOutput } from './formatDeployOutput';
import { getMergedDeployFailures } from './getMergedDeployFailures';

/** Present + persist an already-completed (data-only) deploy outcome. The deploy itself ran in services. */
export const deployFromOutcome = Effect.fn('deployFromOutcome')(function* (outcome: DeployOutcome) {
  clearDeployDiagnostics();
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const channelService = yield* api.services.ChannelService;
  yield* channelService.appendToChannel(yield* formatDeployOutput(outcome));
  yield* maybeStoreDeployResult(outcome);

  const failedResponses = getMergedDeployFailures(outcome); // sync (Task 4)
  const failedWithPaths = failedResponses.filter(
    (fr): fr is typeof fr & { filePath: string } => typeof fr.filePath === 'string' && fr.filePath.length > 0
  );
  if (failedResponses.length > 0) {
    if (failedWithPaths.length > 0) yield* applyDeployDiagnostics(failedWithPaths);
    yield* channelService.getChannel.pipe(Effect.map(channel => channel.show()));
    return yield* new DeployCompletedWithErrorsError({ userMessage: nls.localize('deploy_completed_with_errors_message') });
  }
});
```
NOTE on channel ordering: the legacy path prints "Starting metadata deployment..." BEFORE the deploy. Keep that by printing it in the command (Step 2) before calling `deployFromSource`. Verify the format test does not assert the "Starting..." line as part of `formatDeployOutput`'s output (it is appended separately, so it should not).

- [ ] **Step 2: Rewrite `deployManifestCommand` — keep conflict pass, switch the deploy**

The existing command does: resolve manifest → `getComponentSetFromManifest(uri)` → `ensureNonEmptyComponentSet` → `withPreparationProgress('deploy', cs => detectConflicts(cs, 'deploy'))` → `deployComponentSet({componentSet})`. Change ONLY the final deploy step: after conflict detection passes, deploy via the data-only spec path and present via `deployFromOutcome`.

```ts
export const deployManifestCommand = Effect.fn('deployManifestCommand')(
  function* (manifestUri?: URI) {
    yield* Effect.annotateCurrentSpan({ manifestUri });
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const channelService = yield* api.services.ChannelService;
    const resolved = manifestUri ?? (yield* api.services.EditorService.getActiveEditorUri());
    const spec = { kind: 'manifest', manifestUri: resolved.toString() } as const;

    // Conflict detection stays on the existing ComponentSet path (deferred migration).
    yield* Effect.succeed(resolved).pipe(
      Effect.flatMap(uri => api.services.ComponentSetService.getComponentSetFromManifest(uri)),
      Effect.flatMap(api.services.ComponentSetService.ensureNonEmptyComponentSet),
      withPreparationProgress('deploy', cs => detectConflicts(cs, 'deploy'))
    );

    // Deploy is now DATA-ONLY: services builds + deploys + returns an owned DeployOutcome.
    yield* channelService.appendToChannel('Starting metadata deployment...');
    const outcome = yield* api.services.MetadataDeployService.deployFromSource(spec, { ignoreConflicts: true });
    return yield* deployFromOutcome(outcome);
  },
  Effect.catchTag('NoActiveEditorError', () => new ManifestSelectionRequiredError({ message: nls.localize('deploy_select_manifest') })),
  Effect.catchTag('ConflictsDetectedError', err =>
    handleConflictWithRetry({
      pairs: err.pairs,
      operationType: err.operationType,
      // On retry, conflicts were acknowledged — deploy data-only with the spec.
      retryOperation: api.services.MetadataDeployService.deployFromSource(
        { kind: 'manifest', manifestUri: err.componentSet ? /* re-resolve */ undefined! : undefined! },
        { ignoreConflicts: true }
      ).pipe(Effect.flatMap(deployFromOutcome))
    })
  ),
  withConfigurableSuccessNotification(nls.localize('command_succeeded_text', nls.localize('deploy_in_manifest_text')))
);
```
RESOLVE the retry-spec scope: the `ConflictsDetectedError` carries `componentSet` today, but the retry must now re-issue the SPEC, not the ComponentSet. `spec`/`resolved` are inside the function body, not the `catchTag` closure. Restructure so the manifest URI is available to the retry: simplest is to move the whole pipeline into a `Effect.fn` that takes `manifestUri` and closes over `spec`, then attach `catchTag` to its invocation — OR re-resolve the manifest in the handler from the original `manifestUri` arg. The engineer MUST make this compile and preserve the retry semantics (acknowledge conflicts, then deploy). Use the actual `ConflictsDetectedError` tag/fields (verify in `conflictErrors.ts`). DO NOT leave `undefined!` placeholders — wire the real manifest URI through.

- [ ] **Step 3: (No conflict-UI change.)** `handleConflictWithRetry`, `detectConflicts`, `conflictErrors.ts`, `conflictFlow.ts` are UNCHANGED — the conflict pass still uses the live ComponentSet path. Only the deploy + presentation changed.

- [ ] **Step 4: Run the deployManifest tests**

Run: `cd packages/salesforcedx-vscode-metadata && npm test -- deployManifest deployFromOutcome`
Expected: PASS. Update deployManifest test mocks: keep the conflict-path mocks (`getComponentSetFromManifest`, `detectConflicts`), and mock `api.services.MetadataDeployService.deployFromSource` to return an owned `DeployOutcome` (instead of mocking the old `MetadataDeployService.deploy`). Add a `deployFromOutcome` test asserting: success outcome → channel gets formatted text + no diagnostics; failure outcome (a `state:'Failed'` fileResponse with path) → `applyDeployDiagnostics` called + `DeployCompletedWithErrorsError`.

- [ ] **Step 5: Full metadata compile + lint + test**

Run: `cd packages/salesforcedx-vscode-metadata && npm run compile && npm run lint && npm test`
Expected: 0 errors; all green. `deployComponentSet.ts` is untouched, so the other deploy commands (deploySourcePath, projectDeployStart, deployOnSave) still compile and pass.

- [ ] **Step 6: Commit**

```bash
git add packages/salesforcedx-vscode-metadata/src
git commit -m "refactor(metadata): deployManifest deploys data-only via deployFromSource - W-22419571"
```

---

### Task 8: End-to-end verification of the prototype

**Files:**
- Test only — no source changes unless a defect is found.

- [ ] **Step 1: Build both packages from a clean state**

Run: `cd /Users/peter.hale/git/vse && npm run compile -w packages/salesforcedx-vscode-services -w packages/salesforcedx-vscode-metadata`
Expected: 0 errors.

- [ ] **Step 2: Run both packages' full test suites**

Run: `cd /Users/peter.hale/git/vse && npm test -w packages/salesforcedx-vscode-services -w packages/salesforcedx-vscode-metadata`
Expected: all green.

- [ ] **Step 3: Confirm the DEPLOY is data-only for this flow**

Run: `grep -nE "MetadataDeployService\.deploy\b|deployComponentSet\(|deployFromSource" packages/salesforcedx-vscode-metadata/src/commands/deployManifest.ts`
Expected: deployManifest uses `MetadataDeployService.deployFromSource` for the deploy, NOT the live-ComponentSet `deploy` and NOT `deployComponentSet({componentSet})`. (It STILL references `getComponentSetFromManifest` + `detectConflicts` for the conflict pass — that is in-scope-deferred and expected; note it explicitly in the ledger.)

- [ ] **Step 4: Confirm no live DeployResult import remains in the migrated files**

Run: `grep -rnE "from '@salesforce/source-deploy-retrieve'" packages/salesforcedx-vscode-metadata/src/shared/deploy/formatDeployOutput.ts packages/salesforcedx-vscode-metadata/src/shared/deploy/getMergedDeployFailures.ts packages/salesforcedx-vscode-metadata/src/shared/deploy/deployDiagnostics.ts`
Expected: no `DeployResult`/`DeployMessage`/`FileResponseFailure` type imports in these three files (they now use owned types). `formatDeployOutput`/diagnostics import owned types from `salesforcedx-vscode-services`.

- [ ] **Step 5: Record prototype outcome in the ledger**

Append to `.superpowers/sdd/progress.md` a note: prototype proven (or list any deviations/decisions the controller had to make, especially the Task 3 conflict-detection port and the Task 7 conflict-UI field question).

- [ ] **Step 6: No commit needed unless a fix was made.**

---

## Self-Review

**Spec coverage:**
- Enrich `DeployOutcome` → Task 1/2. ✓
- Push build+deploy+conflict orchestration into services → Task 3. ✓
- Formatters/diagnostics/storage consume owned outcome → Tasks 4/5/6. ✓
- deployManifest flow end-to-end data-only → Task 7. ✓
- Equivalence gate (channel/diagnostics/storage/conflict-retry) → Tasks 4–8 preserve strings + behavior; Task 8 verifies. ✓

**Open risks the executor must surface (not silently resolve):**
1. **Task 7 retry-spec scoping** — the `ConflictsDetectedError` retry must re-issue the manifest SPEC, not the (now-boundary-forbidden) ComponentSet. The manifest URI must be threaded into the `catchTag` handler. DO NOT leave `undefined!` placeholders — wire the real URI (restructure the pipeline or re-resolve from the `manifestUri` arg). If the conflict retry genuinely cannot re-derive the spec, STOP and report.
2. **Channel ordering** — "Starting metadata deployment..." prints before the (now services-side) deploy; keep it in the command, not in `formatDeployOutput`. Verify format tests don't assert it as part of formatted output.
3. **Owned-type re-export path** — `DeployOutcome`/`FileResponseInfo`/`ComponentFailureInfo` must be importable from the `salesforcedx-vscode-services` package entry (Task 4 adds the re-export if missing). Verify the import specifier metadata uses (`'salesforcedx-vscode-services'`) resolves these types.

**Out of scope (deferred, by decision):** conflict detection migration into services; removal of `getComponentSetFromManifest`/`deploy` deprecated getters (Phase E); retrieve/delete flows; the other deploy commands (deploySourcePath/projectDeployStart/deployOnSave).

**Type consistency:** `DeployOutcome`, `FileResponseInfo`, `ComponentFailureInfo`, `DeployFromSourceOptions`, `deployFromOutcome`, `getMergedDeployFailures(outcome)` (sync) — names used consistently across Tasks 1–8. (Note: earlier draft mentioned `DeployConflictInfo`/`DeployConflictsError` — REMOVED from scope; conflict detection stays in metadata.)
