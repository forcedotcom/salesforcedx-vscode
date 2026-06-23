# Metadata Deploy+Retrieve Data-Only Rollout Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Extend the proven deployManifest data-only pattern across the rest of the metadata package's deploy, delete, and retrieve flows so no live SDR `DeployResult`/`RetrieveResult` crosses the services→metadata boundary (conflict detection excepted — see below).

**Architecture:** The prototype (commits 628b54a33..7031e6edf) already built the deploy infrastructure: `toDeployOutcome`/`toRetrieveOutcome` exported from the services entry; enriched owned `DeployOutcome`; shared owned-type `formatDeployOutput`/`getMergedDeployFailures`/`applyDeployDiagnostics`/`maybeStoreDeployResult`; `deployFromOutcome` orchestrator; `deployComponentSet` already maps its `DeployResult`→`DeployOutcome` and reuses the shared helpers; `deployFromSource(spec,{ignoreConflicts?})` and `retrieveToSource(spec,{ignoreConflicts?})` wired through service/contract/plainApi. This plan switches the remaining deploy commands to `deployFromSource`, enriches+migrates the retrieve flow the same way, and handles the delete path.

**Tech Stack:** TypeScript, Effect-TS, Jest, npm workspaces + Wireit. Packages: `salesforcedx-vscode-services`, `salesforcedx-vscode-metadata`.

## Global Constraints

- SCOPE DECISION (carried from the prototype): **conflict detection STAYS IN METADATA** and is OUT OF SCOPE. Commands keep their existing conflict pass on the getter-derived ComponentSet (`getComponentSetFrom*` + `detectConflicts`), then deploy/retrieve data-only with `{ignoreConflicts:true}`. The `getComponentSetFrom*` getters' removal is deferred until conflict detection itself migrates.
- Owned types in `src/owned/*.ts` import nothing (guard: `test/jest/owned/ownedTypes.test.ts`, excludes `*Mapper.ts`). Owned types are `type` aliases with `readonly` members.
- Every commit MUST leave the WHOLE repo compiling (pre-commit hook runs `compile` across all packages). Do not split a task such that an intermediate commit breaks compile.
- Channel output strings, Problems-panel diagnostics, and result-storage JSON MUST remain equivalent (existing tests are the gate). Commit-message header ≤ 100 chars.
- Use npm scripts (not raw npx) for compile/lint. After editing services `src`, the metadata tests load the services **`dist/` bundle** via the bare import — run `npm run vscode:bundle -w packages/salesforcedx-vscode-services` before metadata tests that import the entry, and `npx jest --clearCache` if a stale transform is suspected.
- Branch `phale/W-22419571-services-data-only`. Do NOT switch/create branches.

---

### Task R1: Switch `deploySourcePath` + `projectDeployStart` to data-only deploy

**Files:**
- Modify: `packages/salesforcedx-vscode-metadata/src/commands/deploySourcePath.ts`, `src/commands/projectDeployStart.ts`
- Test: their existing jest suites (if present) + verify deployOnSaveService still green.

**Interfaces:**
- Consumes: `api.services.MetadataDeployService.deployFromSource(spec, {ignoreConflicts:true})` (Effect path); `deployFromOutcome(outcome)` from `../shared/deploy/deployFromOutcome`; existing conflict pass (`getComponentSetFromUris`/`getComponentSetFromProjectDirectories` + `detectConflicts`).
- Produces: migrated commands; no user-visible change.

- [ ] **Step 1:** Read both command files to capture their exact current pipeline (conflict pass + `deployComponentSet({componentSet})` + the `ConflictsDetectedError` retry that uses `err.componentSet`).

- [ ] **Step 2: `deploySourcePath.ts`** — the spec is `{kind:'paths', uris: <the source URIs the command resolved>}`. Mirror the migrated `deployManifest` exactly: keep the conflict pass (resolve URIs → `getComponentSetFromUris` → `ensureNonEmptyComponentSet` → `withPreparationProgress('deploy', cs => detectConflicts(cs,'deploy'))`), then deploy data-only:
```ts
const spec = { kind: 'paths', uris: resolvedUris.map(u => u.toString()) } as const;
// ...conflict pass on the ComponentSet (unchanged)...
yield* channelService.appendToChannel('Starting metadata deployment...');
const outcome = yield* api.services.MetadataDeployService.deployFromSource(spec, { ignoreConflicts: true });
return yield* deployFromOutcome(outcome);
```
Restructure the `ConflictsDetectedError` retry to re-issue the deploy via an inner `performDeploy` Effect.gen closing over `spec` (same technique as deployManifest's commit 2029f1c81 — read deployManifest.ts for the exact pattern). DO NOT thread `err.componentSet` into the retry.

- [ ] **Step 3: `projectDeployStart.ts`** — the spec is `{kind:'projectDirectories'}`. Same transformation: keep its conflict pass, switch the deploy to `deployFromSource({kind:'projectDirectories'}, {ignoreConflicts:true})` + `deployFromOutcome`, restructure the retry.

- [ ] **Step 4:** `cd packages/salesforcedx-vscode-metadata && npm run compile && npm run lint`. Then run the commands' suites + deployOnSaveService + deployFromOutcome. All green; deploy output strings unchanged. (`deployComponentSet.ts` remains for any still-unmigrated caller; if NONE remain after this task, leave it — Phase E removes dead code.)

- [ ] **Step 5: Commit** `refactor(metadata): deploySourcePath + projectDeployStart deploy data-only - W-22419571`

---

### Task R2: Migrate the delete path (`deleteComponentSet` formatting already owned)

**Files:**
- Modify: `packages/salesforcedx-vscode-metadata/src/commands/deleteSourcePath.ts`, `src/shared/delete/deleteComponentSet.ts`
- Test: their suites.

**Context:** `deleteComponentSet.ts:32` calls `MetadataDeployService.deploy(deleteSet)` (a live deploy of a delete-marked ComponentSet) and consumes the `DeployResult` via `result.getFileResponses()` + `formatDeployOutput`. Its formatting was already migrated to owned types in the prototype (it calls `formatDeployOutput(toDeployOutcome(result))`). The deletion is built via `MetadataDeleteService.markComponentsForDeletion(componentSet)` then deployed.

**Decision for delete:** Deleting requires a delete-MARKED ComponentSet, which `deployFromSource(spec)` (building from a plain spec) does NOT produce — a spec-based deploy would deploy the components, not delete them. Therefore the delete path **legitimately cannot use `deployFromSource(spec)`** as-is. Two options — pick per Step 1's finding:
  - (a) Keep `deleteComponentSet` deploying the marked ComponentSet via the existing `MetadataDeployService.deploy(deleteSet)` getter, but map the result to owned outcome for ALL consumption (`toDeployOutcome(result)`) — which the prototype already did for formatting. Confirm NO raw `DeployResult` field is read anywhere in the delete path beyond the mapped outcome. If so, the delete path is already as data-only as the deferred-conflict scope allows (it still uses the `deploy(ComponentSet)` getter, removal deferred with the others).
  - (b) If a `deleteFromSource(spec)` owned method is warranted, that is a NEW services method — OUT OF SCOPE for this rollout; note it for a future task.

- [ ] **Step 1:** Read `deleteComponentSet.ts` + `deleteSourcePath.ts` fully. Confirm whether any raw `DeployResult` field (beyond what `toDeployOutcome` captures) is still read. If the only `DeployResult` use is `formatDeployOutput(toDeployOutcome(result))` and `getFileResponses()` for failure detection, migrate those reads to the owned outcome (`outcome.fileResponses`, `getMergedDeployFailures(outcome)`), keeping the `deploy(deleteSet)` getter call (option a).
- [ ] **Step 2:** Apply option (a): after `const result = yield* MetadataDeployService.deploy(deleteSet)`, `const outcome = toDeployOutcome(result)` and route all downstream consumption through `outcome` + the shared owned helpers. The delete path now consumes only owned data (the `deploy(ComponentSet)` getter call remains, deferred-removal like the conflict getters).
- [ ] **Step 3:** compile + lint + delete suites green; output unchanged.
- [ ] **Step 4: Commit** `refactor(metadata): delete path consumes owned DeployOutcome - W-22419571`

---

### Task R3: Migrate `formatRetrieveOutput` + `maybeStoreRetrieveResult` + `retrieveHasErrors` to owned `RetrieveOutcome`

**Files:**
- Modify: `packages/salesforcedx-vscode-services/src/owned/deploy.ts` (enrich `RetrieveOutcome` minimally), `src/owned/deployMapper.ts` (`toRetrieveOutcome`)
- Modify: `packages/salesforcedx-vscode-metadata/src/shared/retrieve/formatRetrieveOutput.ts`, `src/shared/retrieve/retrieveOutcome.ts` (`retrieveHasErrors`), `src/conflict/resultStorage.ts` (`maybeStoreRetrieveResult`)
- Test: `formatRetrieveOutput`/`retrieveOutcome`/`resultStorage` suites.

**Interfaces:**
- `RetrieveOutcome` currently `{success, status, fileResponses}`. `formatRetrieveOutput` needs only `fileResponses[state/type/filePath/fullName/error]` (already present) + success/failure split (by `state==='Failed'`). `maybeStoreRetrieveResult` needs per-component `{type, fullName, lastModifiedDate}` from `result.response.fileProperties` — NOT on `RetrieveOutcome` today. `retrieveHasErrors` needs `success`/`status` + any-failed (already derivable).

- [ ] **Step 1: Enrich `RetrieveOutcome`** in `src/owned/deploy.ts` to add the storage data:
```ts
export type RetrievedComponentInfo = { readonly type: string; readonly fullName: string; readonly lastModifiedDate: string };
export type RetrieveOutcome = {
  readonly success: boolean;
  readonly status: string;
  readonly fileResponses: readonly FileResponseInfo[];
  /** Per-component server metadata (from fileProperties) for result-storage timestamps. */
  readonly components: readonly RetrievedComponentInfo[];
};
```
- [ ] **Step 2: Map it** in `toRetrieveOutcome` (`src/owned/deployMapper.ts`): map `getFileProperties(result)`-equivalent — read `result.response?.fileProperties` (array or single; normalize like deploy's `componentFailures`) → `{type: fp.type, fullName: fp.fullName, lastModifiedDate: fp.lastModifiedDate}`. (Check how metadata's `getFileProperties` helper in `src/conflict/shared.ts` extracts them; mirror that extraction in the mapper.) Add the `components` field; keep `fileResponses` mapping as-is.
- [ ] **Step 3:** `npm run vscode:bundle -w packages/salesforcedx-vscode-services` after the services edit so metadata picks up the new `dist`. Add/extend a `deployMapper` test case asserting `toRetrieveOutcome` populates `components` from fileProperties.
- [ ] **Step 4: `formatRetrieveOutput`** — change param to `(outcome: RetrieveOutcome | undefined, fileResponsesFromDelete: readonly FileResponseInfo[] = [])`. Replace `result?.getFileResponses()` with `outcome?.fileResponses ?? []`; success = `fr.state !== 'Failed'`, failure = `fr.state === 'Failed'` (drop `isSDRSuccess`/`isSDRFailure`/ExtensionProviderService). KEEP output strings byte-identical (`=== Retrieved Source (N) ===`, `${state} ${type} ${filePath?URI.file(...):fullName}`, `=== Retrieve Errors (N) ===`, `ERROR: ${filePath??fullName}: ${error}`). Make it a plain `(…) => string` if no service is needed.
- [ ] **Step 5: `maybeStoreRetrieveResult`** — change param to `(outcome: RetrieveOutcome)`: `isSucceeded(outcome.status)`, components from `outcome.components.map(c => toStoredComponent(c.type, c.fullName, c.lastModifiedDate))`. Drop the `RetrieveResult` import + `getFileProperties` call.
- [ ] **Step 6: `retrieveHasErrors`** — change param to `(outcome: RetrieveOutcome): boolean` (sync): `outcome.fileResponses.some(fr => fr.state === 'Failed')` OR status indicates failure (mirror the current `result.response` status check using `outcome.status`). Drop the live-result reads.
- [ ] **Step 7:** Adapt the existing live-`RetrieveResult` caller (`retrieveComponentSet.ts`) to map via `toRetrieveOutcome(result)` and reuse the rewritten helpers (mirrors `deployComponentSet`). compile + lint + retrieve suites green; output strings unchanged.
- [ ] **Step 8: Commit** `refactor(metadata): retrieve formatting+storage consume owned RetrieveOutcome - W-22419571`

---

### Task R4: Switch `retrieveManifest` + `retrieveSourcePath` to data-only retrieve

**Files:**
- Modify: `packages/salesforcedx-vscode-metadata/src/commands/retrieveManifest.ts`, `src/commands/retrieveSourcePath.ts`
- Add: `packages/salesforcedx-vscode-metadata/src/shared/retrieve/retrieveFromOutcome.ts` (thin orchestrator mirroring `deployFromOutcome` — clear/append/format/store/error using the owned helpers from R3)
- Test: their suites.

**Interfaces:**
- Consumes: `api.services.MetadataRetrieveService.retrieveToSource(spec, {ignoreConflicts:true})` → `RetrieveOutcome`; the R3 helpers; existing conflict pass.

- [ ] **Step 1:** Create `retrieveFromOutcome.ts`: takes `outcome: RetrieveOutcome` (+ optional `fileResponsesFromDelete`), prints the `Retrieving N components...`/format lines, `maybeStoreRetrieveResult(outcome)`, and fails with `RetrieveCompletedWithErrorsError` when `retrieveHasErrors(outcome)`. Model it exactly on `retrieveComponentSet.ts`'s tail, but starting from an owned outcome. (If `retrieveComponentSet` and this become near-identical, extract a shared `presentRetrieveOutcome`.)
- [ ] **Step 2: `retrieveManifest.ts`** — spec `{kind:'manifest', manifestUri: resolved.toString()}`. Keep conflict pass on `getComponentSetFromManifest`; switch the retrieve to `retrieveToSource(spec, {ignoreConflicts:true})` + `retrieveFromOutcome`. Restructure the `ConflictsDetectedError` retry to re-issue the spec (inner `performRetrieve` closure), not `err.componentSet`.
- [ ] **Step 3: `retrieveSourcePath.ts`** — spec `{kind:'paths', uris}`. Same transformation.
- [ ] **Step 4:** compile + lint + retrieve-command suites green; output unchanged.
- [ ] **Step 5: Commit** `refactor(metadata): retrieveManifest + retrieveSourcePath retrieve data-only - W-22419571`

---

### Task R5: `projectRetrieveStart` + `diffHelpers` — the ComponentSet-merge / to-directory cases

**Files:**
- Inspect/Modify: `packages/salesforcedx-vscode-metadata/src/commands/retrieveStart/projectRetrieveStart.ts`, `src/shared/diff/diffHelpers.ts`
- Test: their suites.

**Context — these are the hard cases the original audit flagged (Sites 16/17):**
- `projectRetrieveStart.ts:49` merges `getRemoteNonDeletesAsComponentSet({applyIgnore})` + `getRemoteDeletesAsComponentSet()` into one ComponentSet via `.add()`, then retrieves it. This is ComponentSet-mutation the owned surface doesn't model.
- `diffHelpers.ts:53` calls `retrieveComponentSetToDirectory(componentSet, cacheDirUri)` — retrieve to an arbitrary directory (not merge-to-project), consumed by conflict diffing.

- [ ] **Step 1: Investigate** exactly what each needs. For `projectRetrieveStart`: does the merged ComponentSet get retrieved to the project (→ could be `retrieveToSource({kind:'projectDirectories'})` or a tracking-based spec)? Or is the remote-changes ComponentSet fundamentally tracking-derived (no SourceSpec equivalent)? For `diffHelpers`: retrieve-to-directory has no owned equivalent yet.
- [ ] **Step 2: DECISION GATE — report to controller before building.** These likely need EITHER (a) a new owned services method (`retrieveRemoteChangesToSource`, `retrieveToDirectory(spec, dirUri)`) — which expands the owned surface, OR (b) staying on the existing getter+ComponentSet path as explicitly-deferred (like conflict detection). Do NOT invent owned surface unilaterally. Present findings + the (a)/(b) recommendation per file to the controller and STOP for a decision.
- [ ] **Step 3:** (after decision) implement the agreed approach; compile + lint + suites green.
- [ ] **Step 4: Commit** with an accurate message reflecting what was done vs deferred.

---

### Task R6: Metadata end-to-end verification

- [ ] **Step 1:** `npm run vscode:bundle -w packages/salesforcedx-vscode-services` then `npx jest --clearCache` (in each package) to avoid stale-bundle/cache.
- [ ] **Step 2:** full suites: services + metadata both green.
- [ ] **Step 3: Boundary audit** — `grep -rnE "MetadataDeployService\.deploy\b|MetadataRetrieveService\.retrieveComponentSet\b|getFileResponses\(\)|: (DeployResult|RetrieveResult)\b" packages/salesforcedx-vscode-metadata/src --include=*.ts | grep -v /out/` — every remaining hit must be EITHER an explicitly-deferred path (delete's `deploy(deleteSet)`, conflict-pass getters, R5-deferred items) OR a `toDeployOutcome/toRetrieveOutcome` mapping line. List anything else as a gap.
- [ ] **Step 4:** Record in the ledger what is fully data-only vs explicitly deferred (conflict detection, delete's marked-set deploy, any R5 deferral). No commit unless a fix was made.

## Self-Review
- Deploy completion (R1) + delete (R2) + retrieve enrichment (R3) + retrieve commands (R4) cover the mechanical majority. R5 isolates the genuinely hard merge/to-directory cases behind a decision gate (no unilateral surface invention). R6 audits the boundary and records deferrals honestly.
- Type consistency: `RetrieveOutcome` gains `components: RetrievedComponentInfo[]`; `formatRetrieveOutput(outcome)`, `maybeStoreRetrieveResult(outcome)`, `retrieveHasErrors(outcome)` all owned-typed; `retrieveFromOutcome` mirrors `deployFromOutcome`. Names consistent across R3/R4.
- Open risk: the retrieve `ConflictsDetectedError` retry-spec scoping (same as deploy — re-issue spec, no ComponentSet). R5 explicitly gated.
