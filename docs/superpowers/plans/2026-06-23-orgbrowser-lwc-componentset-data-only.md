# org-browser + lwc ComponentSet Data-Only Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Migrate org-browser (8 sites) + lwc's 2 ComponentSet sites off the live-`ComponentSet` getters onto owned data, by adding a small owned surface (members filter on `describeProjectComponents`, two `ComponentSetInfo` lookup helpers, an owned members-based retrieve) — no SDR instance crosses the boundary.

**Architecture:** Extend the owned surface minimally, then migrate the two consumers. The data the consumers need (component fullNames, file paths for presence checks) already lives in `ComponentSetInfo.components[]` (`fullName`, `type`, `contentPaths`); we add pure helper functions over it plus a members filter so `describeProjectComponents` can scope results. org-browser's members-based org retrieve gets a new owned `retrieveMembers`.

**Tech Stack:** TypeScript, Effect-TS, Jest, npm workspaces + Wireit.

## Global Constraints

- Owned types/helpers in `src/owned/*.ts` import nothing from `@salesforce/*`/jsforce/effect (guard excludes `*Mapper.ts`). Owned types are `type` aliases, `readonly` members.
- After editing services `src`, rebuild the bundle (`npm run vscode:bundle -w packages/salesforcedx-vscode-services`) before consumer tests that import the entry; `npx jest --clearCache` if stale.
- Every commit leaves the WHOLE repo compiling. npm scripts not raw npx. Commit headers ≤100 chars (use a short header + body if needed).
- Conflict detection / deferred items unchanged. Don't touch diffHelpers, deployOnSaveService, core.
- Branch `phale/W-22419571-services-data-only`; do not switch/create branches.

---

### Task O1: Owned surface — members filter + ComponentSetInfo helpers

**Files:**
- Modify: `packages/salesforcedx-vscode-services/src/owned/deploy.ts` (SourceSpec members), `src/owned/components.ts` (owned member type + helpers OR a sibling `componentSetInfoHelpers.ts`), `src/core/componentSetService.ts` (thread members), `src/contract.ts` + `src/plainApi.ts` (expose helpers if surfaced via api), `src/index.ts` (export helpers + member type).
- Test: `src/owned` helper unit test + componentSetService test.

**Interfaces produced (used by O2/O3):**
- `OwnedMetadataMember = { readonly type: string; readonly fullName: string }` (owned, in `components.ts`).
- `SourceSpec` projectDirectories variant gains optional members: `{ readonly kind: 'projectDirectories'; readonly members?: readonly OwnedMetadataMember[] }`.
- Pure helpers (exported from services entry): `componentSetHas(info: ComponentSetInfo, member: OwnedMetadataMember): boolean` and `componentFilenamesByNameAndType(info: ComponentSetInfo, member: OwnedMetadataMember): readonly string[]`.

- [ ] **Step 1: Add the owned member type to `components.ts`:**
```ts
export type OwnedMetadataMember = { readonly type: string; readonly fullName: string };
```
- [ ] **Step 2: Extend the SourceSpec projectDirectories variant in `deploy.ts`:**
```ts
| { readonly kind: 'projectDirectories'; readonly members?: readonly import('./components').OwnedMetadataMember[] }
```
(Use a relative `import('./components')` type ref, or add a top-of-file `import type { OwnedMetadataMember } from './components';` — match the file's existing style; owned files may import other owned files, just not 3pp.)
- [ ] **Step 3: Thread members through `buildComponentSet`'s projectDirectories case** (`componentSetService.ts`):
```ts
case 'projectDirectories':
  return yield* getComponentSetFromProjectDirectories(
    spec.members ? { metadataMembers: spec.members.map(m => ({ type: m.type, fullName: m.fullName })) } : undefined
  );
```
(`getComponentSetFromProjectDirectories` already accepts `{metadataMembers?: readonly MetadataMember[]}`; the owned `{type,fullName}` is structurally compatible with SDR `MetadataMember`. If the SDR type needs an exact shape, map accordingly.)
- [ ] **Step 4: Add the pure helpers.** Create `src/owned/componentSetInfoHelpers.ts` (owned, imports only `./components` types):
```ts
import type { ComponentSetInfo, ComponentInfo, OwnedMetadataMember } from './components';
const matches = (c: ComponentInfo, m: OwnedMetadataMember): boolean => c.type === m.type && c.fullName === m.fullName;
/** True when a component of the given type+fullName is present in the set. */
export const componentSetHas = (info: ComponentSetInfo, member: OwnedMetadataMember): boolean =>
  info.components.some(c => matches(c, member));
/** The on-disk file paths for a component of the given type+fullName (empty if absent). */
export const componentFilenamesByNameAndType = (
  info: ComponentSetInfo,
  member: OwnedMetadataMember
): readonly string[] => info.components.find(c => matches(c, member))?.contentPaths ?? [];
```
- [ ] **Step 5: Export from the services entry** (`src/index.ts`): `export { componentSetHas, componentFilenamesByNameAndType } from './owned/componentSetInfoHelpers';` and add `OwnedMetadataMember` to the `./owned/components` type export.
- [ ] **Step 6: Tests.** Unit test the two helpers (present → true / paths; absent → false / []). Verify ownedTypes guard still green (helpers file is `*Helpers.ts`, not a type module — confirm the guard's glob: it excludes `*Mapper.ts`; this new file imports only owned types so it passes the no-3pp check regardless). Add a componentSetService test that `describeProjectComponents({kind:'projectDirectories', members:[...]})` filters.
- [ ] **Step 7:** services compile + lint + `npx jest`; `npm run vscode:bundle`. Commit: `feat(services): owned ComponentSetInfo member filter + presence helpers - W-22419571`.

---

### Task O2: Migrate lwc ComponentSet sites

**Files:** Modify `packages/salesforcedx-vscode-lwc/src/commands/createLwc.ts`, `src/commands/renameLwc.ts`. Test: their suites.

**Interfaces consumed:** `describeProjectComponents({kind:'projectDirectories', members:[...]})` → `ComponentSetInfo`.

- [ ] **Step 1:** In each, replace `componentSetService.getComponentSetFromProjectDirectories({metadataMembers:[{type:LWC_TYPE,fullName:'*'},{type:AURA_TYPE,fullName:'*'}]})` + `.getSourceComponents()` + `.map(c => c.fullName...)` with `(yield* api.services.ComponentSetService.describeProjectComponents({kind:'projectDirectories', members:[{type:LWC_TYPE,fullName:'*'},{type:AURA_TYPE,fullName:'*'}]})).components.map(c => c.fullName.toLowerCase())` (createLwc) / equivalent (renameLwc). Match each call site's exact downstream use of the names list.
- [ ] **Step 2:** Drop any now-unused SDR/ComponentSet imports. compile + lint + lwc jest green.
- [ ] **Step 3:** Commit `refactor(lwc): describeProjectComponents members filter instead of ComponentSet getter - W-22419571`.

---

### Task O3: Owned members-based retrieve

**Files:** Modify `packages/salesforcedx-vscode-services/src/core/metadataRetrieveService.ts` (+ contract + plainApi + a deployMapper if needed). Test: existing or note absence.

**Interfaces produced:** `MetadataRetrieveService.retrieveMembers(members: readonly OwnedMetadataMember[], opts?: RetrieveOptions): RetrieveOutcome`. Wraps the existing internal `retrieve(members, options)` (which takes SDR `MetadataMember[]` — map the owned `{type,fullName}` to it) and maps its `RetrieveResult` via `toRetrieveOutcome`.

- [ ] **Step 1:** Add `retrieveMembers` to MetadataRetrieveService: map owned members → SDR `MetadataMember[]` shape, call the existing `retrieve(members, opts)`, `return toRetrieveOutcome(result)`. (The existing `retrieve` may return `string | RetrieveResult` per org-browser's current type-check — inspect; if it can return a string sentinel, handle it: map a string to a failed `RetrieveOutcome{success:false,status:string,...}`.)
- [ ] **Step 2:** Wire through contract + plainApi (returns `RetrieveOutcome`; takes `readonly OwnedMetadataMember[]`).
- [ ] **Step 3:** services compile + lint + jest; `npm run vscode:bundle`. Commit `feat(services): owned retrieveMembers returning RetrieveOutcome - W-22419571`.

---

### Task O4: Migrate org-browser

**Files:** Modify `packages/salesforcedx-vscode-org-browser/src/index.ts` (getConnection availability), `src/tree/metadataTypeTreeProvider.ts` (describe + 3 ComponentSet sites + the customField/listMetadata mappers), `src/commands/retrieveMetadata.ts` (ComponentSet + confirmOverwrite), `src/services/orgBrowserMetadataRetrieveService.ts` (retrieve). Test: org-browser suites.

**Interfaces consumed:** `describeMetadata()` (→ MetadataTypeInfo[]); `describeProjectComponents({kind:'projectDirectories', members?})` (→ ComponentSetInfo); `componentSetHas`/`componentFilenamesByNameAndType` helpers (from O1); `retrieveMembers` (O3); `withDefaultOrg` (availability).

- [ ] **Step 1: index.ts getConnection availability** (~line 44): replace the discarded `getConnection()` with `Effect.tryPromise(() => api.withDefaultOrg(() => undefined)).pipe(Effect.catchAll(() => Effect.void))` (the tryPromise-not-promise rule — a rejected refresh must be catchable), OR drop it if the subsequent `TargetOrgRef()` already warms it (verify behavior).
- [ ] **Step 2: metadataTypeTreeProvider describe** (~72): `describe()` → `describeMetadata()`; the mapper reads `.xmlName` (present on MetadataTypeInfo). Sort/map unchanged.
- [ ] **Step 3: the 3 ComponentSet sites** (~77/95/109) + their mappers (customField.ts, the listMetadata mappers): replace `getComponentSetFromProjectDirectories()` → `describeProjectComponents({kind:'projectDirectories'})` (ComponentSetInfo). Replace `projectComponentSet.getComponentFilenamesByNameAndType({fullName,type})` → `componentFilenamesByNameAndType(info, {fullName,type})` (import the helper from `salesforcedx-vscode-services`). The closures that took a live ComponentSet now take a `ComponentSetInfo`.
- [ ] **Step 4: retrieveMetadata.ts** (~29) `getComponentSetFromProjectDirectories()` → `describeProjectComponents({kind:'projectDirectories'})`; `isMemberPresentInProject` uses `componentSetHas(info, m)` + `componentFilenamesByNameAndType(info, {fullName, type:'CustomField'})`.
- [ ] **Step 5: orgBrowserMetadataRetrieveService.ts** (~27): `MetadataRetrieveService.retrieve(members, opts)` → `retrieveMembers(members, opts)` (owned RetrieveOutcome). Replace `typeof result === 'string'` error check with `!result.success`; `.getFileResponses()` → `result.fileResponses`; `findFirstSuccessfulFile` reads `result.fileResponses[0]?.filePath`. Preserve the channel output + open-file behavior.
- [ ] **Step 6:** Drop unused SDR/ComponentSet imports. compile + lint + org-browser jest green. Boundary check: no `getComponentSetFrom*`/live `retrieve`/`getFileResponses`/`DeployResult`/`RetrieveResult`/`describe()` remain in org-browser src.
- [ ] **Step 7:** Commit `refactor(org-browser): owned describeMetadata/ComponentSetInfo/retrieveMembers - W-22419571`.

---

### Task O5: Verify

- [ ] `npm run vscode:bundle -w packages/salesforcedx-vscode-services`; `npx jest --clearCache` per touched package; full suites services + lwc + org-browser green.
- [ ] Boundary audit: `grep -rnE "getComponentSetFrom|MetadataRetrieveService.retrieve\b|\.getSourceComponents\(\)|\.getComponentFilenamesByNameAndType|: (DeployResult|RetrieveResult|ComponentSet)\b" packages/salesforcedx-vscode-org-browser/src packages/salesforcedx-vscode-lwc/src --include=*.ts | grep -v /out/` — expect none (or only owned-helper calls). Record any residue.
- [ ] Ledger update.

## Self-Review
- O1 owned surface is minimal: one owned member type, one optional spec field, two pure helpers. O2/O4 consume them; O3 adds the members-retrieve org-browser needs. No SDR instance crosses the boundary after O4.
- Type consistency: `OwnedMetadataMember{type,fullName}`, `componentSetHas`/`componentFilenamesByNameAndType`, `retrieveMembers` — names consistent O1→O4.
- Open risk: org-browser's `retrieve` returning `string | RetrieveResult` sentinel — O3 Step 1 must handle the string case in the owned mapping. The mapper-only (types) SDR import rule applies to deployMapper.
