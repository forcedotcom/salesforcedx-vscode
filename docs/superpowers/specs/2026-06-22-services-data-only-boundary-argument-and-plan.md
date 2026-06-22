# Services API: Why Import-Free Types Failed, and the Plan to Reshape the 3pp Getters

**Date:** 2026-06-22
**Work item:** W-22419571
**Status:** Argument + deprecation/reshaping plan (supersedes the owned-closure approach)

---

## Part 1 — Why the "no-imports types" approach was failing us

### The goal we set
Publish a types package (`@salesforce/vscode-services`) whose public surface imports nothing from the
Salesforce SDK (`@salesforce/core`, `jsforce`, `@jsforce/jsforce-node`, source-deploy-retrieve,
source-tracking, templates) or `effect`, so external consumers get strong types — including
`getConnection().query()` — without taking on those dependencies.

### What we built, and what it cost
We proved an owned, import-free type closure is *mechanically* producible, but only by stacking
workarounds, each conceding part of the goal:

1. **API Extractor cannot do it** — the `jsforce`/`@jsforce/jsforce-node` dual-package throws an
   internal `StreamPromise` symbol conflict. Switched to `dts-bundle-generator`.
2. **`dts-bundle-generator` mis-generates Zod v4** (`$ZodType` vs `$ZodTypes`) — `zod` had to be
   excluded; it became a residual external (then dropped as unreachable).
3. **`--no-check` required** — the bundler's own post-gen validation fails on inlined `pino`/`memfs`
   duplicate-identifier noise; we suppress it (and tell consumers to set `skipLibCheck: true`).
4. **Output is non-deterministic** (spaces vs tabs) — required a Prettier post-pass to make the
   drift gate's byte-compare viable.
5. **Behavioral classes cannot nominally conform** — `Connection`/`SfProject`/`ComponentSet` have
   `private` members; TypeScript compares `private` members nominally, so a *copied* class can never
   be assignable to the original **in either direction** (strip the privates and it fails the other
   way: `Property 'logger' is private in Connection but not in Connection$1`). The semantic-drift
   conformance gate had to drop from strict to *structural* for the 5 behavioral types.
6. **Name collisions produce wrong types** — `DeployResult` exists as both jsforce's flat type and
   SDR's class; the bundler's first-export-wins gave consumers the **wrong** one until we
   post-processed a de-collision.
7. **The fatal wiring blocker (Task 2.6)** — even with a perfect owned closure, the published entry
   must express the API surface. `PlainServicesApi`'s signatures reference the **real** SDK
   `Connection` (the extension's implementation returns real instances). Re-exporting that surface
   drags the real SDK imports back in; the owned closure is *structurally identical but nominally
   different*, and **nothing can substitute owned-for-real at the boundary** without either breaking
   the extension's implementation or hand-redeclaring the entire surface. The owned closure we built
   is **not wired to anything** — `getConnection()` still returns the real `Connection`.

### The root cause (the real argument)
Every one of those failures is a *symptom* of one design choice:

> **The services API returns live third-party instances it does not own** — `Connection`,
> `SfProject`, `ComponentSet`, SDR `DeployResult`/`RetrieveResult`. (11 of ~45 members; see Part 2.)

There is a **type-sharing trilemma** for any cross-extension type, and a foreign return type forces
you into one of three losing positions:

1. **Shared type-only dependency** — both sides depend on one published `.d.ts` (`@types/vscode`).
   Works *only* for types the publisher **owns**. A foreign type isn't ours to publish this way.
2. **Consumer re-declares the foreign shape** — this is the "owned closure" we built. It breaks on
   3pp internals (zod/pino), on `private`-member nominal identity, and on name collisions. It is
   *structurally* close but *nominally* a different type, so it never unifies with the consumer's own
   copy of the real thing.
3. **Consumer imports the real foreign type** — the version-coupling and structural-drift the whole
   effort set out to avoid (the original concern: two `Connection`s that don't unify).

**There is no fourth option.** The walls we hit are the *shape of the trilemma*, not tooling
deficiencies. You cannot make a foreign-type-returning API import-free, because publishing a foreign
type is — by definition — one of the three losing positions.

### Handcrafted types vs generated types — does authoring by hand change the trilemma?

The owned closure was produced by **automation** (`dts-bundle-generator`). A fair challenge: the
failures above were tooling failures — what if we *hand-wrote* the owned `.d.ts`, the way
`@types/vscode` is hand-authored? Does that escape the trilemma?

**Answer: handcrafting fixes every *tooling* failure but does NOT break the trilemma — for one
decisive reason.** Separate the two:

**What handcrafting fixes (all of it).** Failures 1–6 above are artifacts of the bundler, and
hand-authoring eliminates each: no api-extractor jsforce conflict, no zod mis-generation, no
`--no-check`, no spaces-vs-tabs non-determinism, no name-collision dual-exports, no 16k-line bloat /
dead 3pp / unreachable Node types. A hand-crafted owned surface is **strictly leaner, cleaner, and
more deterministic** than the generated bundle. *If we ever own a type, we should hand-author it, not
generate it.* (See "the right technique" below.)

**What handcrafting cannot fix: type *identity* at the consumer's boundary.** The trilemma is not
about how the type is produced — it is about whether the consumer can simultaneously hold *our* copy
of a type **and** the real one without conflict. `@types/vscode` works because Microsoft **owns
`TextDocument` end to end**: there is exactly one declaration of it in existence, and the runtime
host implements *that*. There is no *second* `TextDocument` for a consumer to import, so there is
nothing to fail unification against.

A hand-crafted copy of a **foreign** type does not have that property:
- A consumer who uses *only* our hand-written `Connection` and never imports `@salesforce/core` is
  fine (this is the prototype model — genuinely works).
- But the instant that consumer *also* imports `@salesforce/core` — to reach a method we did not
  hand-craft, or because another library hands them a real `Connection` — they now hold **two
  `Connection` types**: ours and core's. Core's `Connection` has `private` members (`logger`, …);
  `private` members are compared **nominally**, tied to the declaring class. So the two declarations
  **do not unify**, regardless of identical structure, and regardless of whether ours was generated
  or lovingly hand-typed. This is exactly trilemma position 2's wall — and **handcrafting lands on it
  just the same.**

So the distinction is sharp:

| | Pure data DTOs | Behavioral classes w/ private members (`Connection`, `ComponentSet`, SDR `DeployResult`) |
|---|---|---|
| **Handcraft a clean owned copy?** | Yes, trivially | Yes — and far cleaner than the generated bundle |
| **Does the handcrafted copy escape the trilemma?** | **Yes** — data has no `private` members, so a hand-written DTO *structurally unifies* with the real one. Position 1 works. | **No** — `private`-member nominal identity makes the hand-written copy a *distinct, non-unifying* type the moment the consumer also has the real `@salesforce/core` copy in scope. Still position 2. |

**Why this strengthens the conclusion, and what it tells us to do.** The fix is not "copy the foreign
type better (by hand)." The fix is to **never copy a foreign type at all** — own a *new* type the
consumer cannot also obtain from `@salesforce/core`, so there is no twin to fail against. That is the
`@types/vscode` property — *one declaration, no twin* — achieved by **owning a different type**, not
by copying a foreign one. `ServicesOrg` (our loan facade) works as a hand-written interface precisely
because it is brand-new: no `@salesforce/core` import can produce a competing `ServicesOrg`.

**The right technique (for the surface we are now designing).** The owned vocabulary in Part 3 —
`ServicesOrg`, `DeployOutcome`, `ProjectInfo`, the request DTOs — **must be hand-authored**, not
generated. Hand-authoring is correct here for the exact reason it failed before is now absent: these
are *owned* types (no foreign twin, no `private`-member identity to preserve), so authoring them by
hand is clean, lean, reviewable, and trilemma-free — the genuine `@types/vscode` model. Generation
only ever existed to *copy foreign types*, which we are no longer doing. We therefore adopt
hand-crafted `.d.ts` for the owned surface and retire the generation apparatus entirely.

### The deeper truth (the architecture insight)
A *service* "crosses a wire": what crosses is **pure data**. In a Node/VS Code process there is no
real wire — "calling a service" is often *getting a reference to a live object* — so the discipline
that would keep a service publishable (data-only boundaries) is easy to violate, and we did. The
services extension is two disjoint things wearing one name:

- **True services** — "do this action, here is the resulting data" (`getApiVersion`,
  `getTargetOrgInfo`, `listMetadata`, and the metadata deploy/retrieve *processes*, which are
  valuable compositions of many SDR calls). These are honestly publishable and already mostly
  data-typed (`DefaultOrgInfo`, `FilePropertiesPlain`, `TraceFlagItem` are services-owned).
- **3pp getters** — `getConnection`/`getSfProject`/`getComponentSetFrom*` and the deploy/retrieve
  methods that *return SDR instances*. These don't cross a wire with data; they hand back a live
  cross-module reference. They are "the trouble," and they are **unpublishable by nature.**

**Conclusion:** import-free types was failing because it was answering the wrong question — *"how do
we publish foreign return types?"* — when the foreign return types should not be on the boundary at
all. The fix is not a better bundler; it is to make the API **data-only**.

### The principle we are adopting
The services API exposes **only**:
1. **"Do this action for me, return the resulting DATA"** — owned data in, owned data out. Includes
   the **loan/bracket pattern** `withDefaultOrg(<R>(org: ServicesOrg) => R)` where the closure
   receives a **services-owned facade type** (`ServicesOrg`/`ServicesConnection`), NEVER the raw
   `@salesforce/core` `Connection`. The service owns the lifecycle (acquire/release) AND the type.
2. **"Give me the DATA so I can build my own instance"** — for capabilities outside the curated
   owned surface, the service returns the data (auth/org/config) and the **consumer constructs its
   own 3pp instance using its own 3pp dependency**, in the consumer's dependency space.

No live 3pp instance crosses the boundary — not as a return, not as a parameter, **not even as a
closure argument.** With this, import-free is no longer a goal to engineer toward; it **falls out for
free**, because the entire surface is services-owned data and owned facade interfaces, which the
publisher can legitimately own (trilemma position 1, the one that works).

---

## Part 2 — The surface, triaged

The current contract has ~45 members. The ones that return (or take) a live 3pp instance — the
deprecation/reshaping targets — are:

| Member | Current return / param (foreign) | Reshape |
|--------|----------------------------------|---------|
| `getConnection()` | `Connection` (@salesforce/core) | **Loan** `withDefaultOrg(org => …)` lending owned `ServicesOrg`; and/or **data** (`api.query(soql) → records`); raw-connection-data escape hatch |
| `getSfProject()` | `SfProject` (@salesforce/core) | **Data** — return owned `ProjectInfo { path, packageDirectories, … }`; or **loan** `withSfProject(p => …)` lending owned `ServicesProject` |
| `deploy(cs: ComponentSet)` → `DeployResult` | param + return foreign | **Action→data** — input: owned deploy request (paths/manifest, not a ComponentSet); output: owned `DeployOutcome { success, status, fileResponses }` |
| `retrieveComponentSet(cs)` → `RetrieveResult` | param + return foreign | **Action→data** — owned retrieve request → owned `RetrieveOutcome` |
| `retrieve(members, opts)` → `RetrieveResult` | return foreign | **Action→data** — owned `RetrieveOutcome` |
| `retrieveComponentSetToDirectory(cs, out)` → `RetrieveResult` | param + return foreign | **Action→data** — owned request → owned outcome |
| `getComponentSetFromUris(uris)` → `ComponentSet` | return foreign | **Remove from boundary** — `ComponentSet` is an *input-building* helper; fold into the deploy/retrieve actions (which take owned requests, not a pre-built ComponentSet) |
| `getComponentSetFromManifest(uri)` → `ComponentSet` | return foreign | same — fold into actions |
| `getComponentSetFromProjectDirectories()` → `ComponentSet` | return foreign | same — fold into actions |
| `getLocalChangesAsComponentSet()` → `ComponentSet[]` | return foreign | **Data** — owned `ChangeSet`/list-of-owned-change-data |
| `getRemoteNonDeletesAsComponentSet(opts)` → `ComponentSet` | return foreign | **Data** — owned change data |

**Already-clean (no change needed — the model to follow):** `getApiVersion`, `getTargetOrgInfo`
(`DefaultOrgInfo`), `getWorkspaceInfo`, `isSalesforceProject`, `isInPackageDirectories`,
`getTargetDevHub`, `getAllAliases`, `getUsernameFromAlias`, file-system ops, editor ops,
`describe` (`DescribeMetadataObject[]` — *but* this is a jsforce type; reshape to owned
`MetadataTypeInfo[]`), `listMetadata` (`FilePropertiesPlain` — owned), source-tracking booleans,
`simpleExec`, settings, `createFromTemplate` (`CreateOutput` — templates type; reshape to owned),
trace flags (owned). Note `describe`/`createFromTemplate`/`getConflicts` return *3pp data types* —
mirror these as owned DTOs (cheap; they're data, no private members).

`ComponentSet` as a **parameter** (`deploy`, `retrieveComponentSet`, `retrieveComponentSetToDirectory`)
is its own leak — the consumer must build a 3pp instance to call us. Reshaped actions take an
**owned request** (paths / manifest URI / member list), and the service builds the ComponentSet
internally.

---

## Part 2b — Repo-wide usage audit of the getters (2026-06-22)

Consumers reach these capabilities almost entirely through the **Effect `services` sub-object**
(`api.services.ConnectionService.getConnection()`, `ComponentSetService.*`), not the plain getters.
Usage outside the services extension, by capability:

| Capability | Refs | Notable consumers |
|---|---|---|
| `ProjectService` (`getSfProject`) | 31 | metadata, apex-testing, soql |
| `ComponentSetService` (`getComponentSetFrom*`) | 31 | metadata-centric |
| `ConnectionService` (`getConnection`) | 25 | apex-testing (15), soql, core, metadata, apex-replay-debugger |
| `MetadataRetrieveService` | 7 | metadata |
| `SourceTrackingService` | 7 | |
| `MetadataDeployService` | 4 | |
| `getLocalChangesAsComponentSet` | 0 | — (droppable) |
| `getRemoteNonDeletesAsComponentSet` | 1 | (near-droppable) |
| `retrieveComponentSetToDirectory` | 1 | (near-droppable) |

**Decisive finding — what consumers actually call on a services-obtained `Connection`:**

```
16  conn.tooling          ← dominant (Tooling API)
 2  conn.request
 2  conn.query
 2  conn.identity
 1  conn.singleRecordQuery
 1  conn.getApiVersion
```

The consumed surface is **small and concentrated** — ~6 operations. A loan facade `ServicesOrg`
exposing `{ tooling, request, query, singleRecordQuery, identity, apiVersion }` would cover
essentially **all** real in-repo `Connection` usage. Consumers do **not** need the full jsforce
`Connection`. This makes the loan reshape realistic (a thin curated facade), not a re-implementation
of jsforce.

**`conn.tooling` — RESOLVED (tooling is an operation flag, not a sub-object).** `@salesforce/core`
itself already models tooling as an *option on the operation*, not navigation to a separate object:
`autoFetchQuery(soql, { tooling: boolean })` and `singleRecordQuery(soql, { tooling?: boolean })`.
Tooling-vs-standard is just an internal path choice — operationally identical. So the loan facade does
NOT expose a `tooling` sub-object (which would leak jsforce's rich `Tooling<S>` type); it exposes
flat operations with a `{ tooling?: boolean }` flag and selects the path internally. The actual
in-repo `conn.tooling.*` usage confirms this is sufficient — all of it is plain CRUD/query:
`query` (17), `create` (4: TraceFlag/DebugLevel/PackageInstallRequest), `update` (2+), `delete` (2),
`sobject(...)` (2). The full `ServicesOrg` operation set covering 100% of real `Connection` usage is
therefore flat and small:

```ts
interface ServicesOrg {
  readonly apiVersion: string;
  query<T>(soql: string, opts?: { tooling?: boolean; autoFetch?: boolean; maxFetch?: number }): Promise<OwnedQueryResult<T>>;
  singleRecordQuery<T>(soql: string, opts?: { tooling?: boolean }): Promise<T>;
  create(sobjectType: string, record: object, opts?: { tooling?: boolean }): Promise<OwnedSaveResult>;
  update(sobjectType: string, record: object, opts?: { tooling?: boolean }): Promise<OwnedSaveResult>;
  delete(sobjectType: string, id: string, opts?: { tooling?: boolean }): Promise<OwnedSaveResult>;
  request<R>(req: string | OwnedHttpRequest): Promise<R>;
  identity(): Promise<OwnedIdentityInfo>;
}
```

All inputs/outputs are owned data; no jsforce type (including `Tooling<S>`) crosses the boundary. No
`ServicesTooling` sub-facade is needed. This was the only open wrinkle in the reshape, and it closes
cleanly.

**Migration concentration:** the work is contained — `salesforcedx-vscode-metadata` (ComponentSet +
Project heavy) and `salesforcedx-vscode-apex-testing` (15 Connection refs) are the bulk. apex-testing
is the right canary for proving the owned surface is complete (Phase D).

## Part 3 — The plan (deprecate + reshape, non-breaking, staged)

This must be **non-breaking** for current in-repo consumers (apex-log, apex-testing, visualforce,
etc. consume the Effect `services` sub-object and some plain getters). So we **add the new
data-only/loan surface alongside the existing getters, deprecate the getters, migrate consumers,
then remove**. The Effect `services` sub-object (internal, effect-coupled, used in-repo) is out of
scope for removal — this is about the *published, cross-extension* surface.

### Phase A — Define the owned vocabulary (HAND-AUTHORED, not generated)
Create services-owned types for everything the reshaped surface exposes. These live in the extension
(source of truth) and are pure data / owned facade interfaces — no 3pp imports. **These are
hand-authored `.d.ts`/`.ts` declarations, the `@types/vscode` way — NOT produced by any bundler.**
Hand-authoring is correct precisely because these are *owned new types* (no foreign twin, no
`private`-member identity to preserve), so the tooling failures that plagued the generated owned
closure (Part 1) cannot occur, and the result is lean, reviewable, and trilemma-free. The generation
apparatus only ever existed to copy foreign types — which we no longer do.
- Owned data DTOs: `DeployOutcome`, `RetrieveOutcome`, `ProjectInfo`, `MetadataTypeInfo` (mirror of
  `DescribeMetadataObject`), `TemplateCreateOutcome` (mirror of `CreateOutput`), `OrgChange` (mirror
  of `ChangeResult`), owned request shapes (`DeployRequest`, `RetrieveRequest`).
- Owned facade interfaces for the loan pattern: `ServicesOrg` (curated org operations returning owned
  data — `query`, `describeGlobal`, etc.), and `ServicesProject` if a loan shape is chosen for project.
- These are small, data-pure, and trivially publishable (trilemma position 1).

### Phase B — Add the reshaped surface (additive, non-breaking)
Add the new members to the contract + plain facade + Effect services, returning owned types:
- `withDefaultOrg(<R>(org: ServicesOrg) => R | Promise<R>): Promise<R>` (loan; service-managed lifecycle).
- `deploy(request: DeployRequest): Promise<DeployOutcome>` (new overload/name, owned in/out).
- `retrieve(request: RetrieveRequest): Promise<RetrieveOutcome>`.
- `getProjectInfo(): Promise<ProjectInfo>` (data) and/or `withSfProject`.
- `getLocalChanges(): Promise<OrgChange[]>`, `getRemoteNonDeletes(...): Promise<OrgChange[]>`.
- `describeMetadata(): Promise<MetadataTypeInfo[]>`, `createFromTemplate(...): Promise<TemplateCreateOutcome>`.
- Escape-hatch data accessors where needed: `getConnectionData(): Promise<ConnectionData>` (auth/org
  data for consumers who build their own `Connection`).
The boundary mapping (real 3pp → owned) happens *inside* the extension, exactly as `getTargetOrgInfo`
already maps to `DefaultOrgInfo`.

### Phase C — Deprecate the 3pp getters
Mark `getConnection`, `getSfProject`, `getComponentSetFrom*`, and the instance-returning
`deploy`/`retrieve*` overloads with `@deprecated` JSDoc pointing to the owned replacement. They keep
working (no break). Document the deprecation timeline and the trilemma rationale (Part 1) so the
"why" is durable.

### Phase D — Migrate in-repo consumers
Move every in-repo consumer off the deprecated getters onto the reshaped surface. This is the dogfood
and the proof the owned surface is complete. (Consumers that genuinely need a raw `Connection` for an
unwrapped jsforce capability use `getConnectionData()` + their own jsforce.)

### Phase E — Remove the getters; publish import-free for free
Once no consumer uses the deprecated getters, remove them from the published surface. The published
types package now has a **data-only + owned-facade** surface → no 3pp imports → import-free **without
any owned-closure machinery, dts-bundle-generator, --no-check, or structural-conformance compromise.**
A simple type-only re-export (trilemma position 1) suffices.

### What this retires
The entire owned-closure apparatus (Tasks 2.2–2.6: `generateSdkClosure`, the 16k-line bundle, the
drift gate, the conformance check, the prune/de-collide/strip post-processing) becomes **unnecessary**
and is removed. Its value was diagnostic: it *proved* foreign return types are unpublishable — and,
per the handcrafted-vs-generated analysis in Part 1, it also proved that **generation was the wrong
technique**: every gate it needed (drift, conformance, de-collide, strip) existed only to manage a
*copy of a foreign type*. The owned surface we are now building is hand-authored and owns *new* types,
so none of that machinery applies. The plain facade + accessor (Phase 1, Task 2.5) are kept and
reused — they sit in front of the new hand-authored data-only surface.

---

## Part 4 — The owned vocabulary (detailed design, grounded in usage)

Every reshaped member, derived from the repo-wide usage audit (Part 2b). **Principle:** plain data
DTOs everywhere, a loan facade ONLY where consumers invoke live operations (the connection). All
types hand-authored in the extension, zero 3pp imports; 3pp→owned mapping happens inside the service
implementations (the existing `getTargetOrgInfo` → `DefaultOrgInfo` model, extended).

### The one loan facade — `ServicesOrg` (replaces `getConnection`)
`withDefaultOrg(<R>(org: ServicesOrg) => R | Promise<R>): Promise<R>` — service owns the connection
lifecycle (acquire/release); the closure receives a services-owned `ServicesOrg`, never a jsforce
`Connection`. Shape (covers 100% of audited `Connection` usage; `tooling` is a flag, not a sub-object):
```ts
interface ServicesOrg {
  readonly apiVersion: string;
  query<T>(soql: string, opts?: { tooling?: boolean; autoFetch?: boolean; maxFetch?: number }): Promise<OwnedQueryResult<T>>;
  singleRecordQuery<T>(soql: string, opts?: { tooling?: boolean }): Promise<T>;
  create(sobjectType: string, record: object, opts?: { tooling?: boolean }): Promise<OwnedSaveResult>;
  update(sobjectType: string, record: object, opts?: { tooling?: boolean }): Promise<OwnedSaveResult>;
  delete(sobjectType: string, id: string, opts?: { tooling?: boolean }): Promise<OwnedSaveResult>;
  request<R>(req: string | OwnedHttpRequest): Promise<R>;
  identity(): Promise<OwnedIdentityInfo>;
}
```

### Data DTOs (everything else)

**Project (replaces `getSfProject`):** `getProjectInfo(): Promise<ProjectInfo>` — flat snapshot, no
methods (the audited path-getters take no args → precomputable; arg-taking `getPackageFromPath` is
unused → dropped):
```ts
type ProjectInfo = {
  path: string; name: string; sourceApiVersion?: string; namespace?: string;
  defaultPackage: PackageDirInfo; packageDirectories: PackageDirInfo[];
  soqlMetadataPath: string; soqlCustomObjectsPath: string; soqlStandardObjectsPath: string;
  fauxStandardObjectsPath: string; fauxCustomObjectsPath: string; typingsPath: string;
};
type PackageDirInfo = { name?: string; path: string; default: boolean; fullPath: string };
```

**Metadata actions (replace `deploy`, `retrieveComponentSet`, `retrieve`,
`retrieveComponentSetToDirectory`, AND the 3 `getComponentSetFrom*` getters — the whole family):**
actions take an owned `SourceSpec`; the service builds the `ComponentSet` internally. No `ComponentSet`
ever crosses the boundary, as a return OR a parameter.
```ts
type SourceSpec =
  | { kind: 'paths'; uris: string[] }
  | { kind: 'manifest'; manifestUri: string }
  | { kind: 'projectDirectories' };
deploy(spec: SourceSpec, opts?: DeployOptions): Promise<DeployOutcome>;
retrieve(spec: SourceSpec, opts?: RetrieveOptions): Promise<RetrieveOutcome>;
type DeployOutcome = { success: boolean; status: string; fileResponses: FileResponseInfo[] };
type RetrieveOutcome = { success: boolean; status: string; fileResponses: FileResponseInfo[] };
type FileResponseInfo = { fullName: string; type: string; state: string; filePath?: string; error?: string };
```

**Component introspection (replaces the introspect-the-ComponentSet usage — projectInfo report,
org-browser tree, package.xml, conflict detection):**
```ts
describeProjectComponents(spec: SourceSpec): Promise<ComponentSetInfo>;
type ComponentSetInfo = { size: number; sourceApiVersion?: string; projectDirectory?: string; components: ComponentInfo[]; packageXml: string };
type ComponentInfo = { fullName: string; type: string; state?: string; xmlPath?: string; contentPaths: string[] };
```

**Source tracking (replaces `getLocalChangesAsComponentSet` [dead], `getRemoteNonDeletesAsComponentSet`,
`getConflicts`-as-ComponentSet):**
```ts
getConflicts(): Promise<OrgChange[]>;
getLocalChanges(): Promise<OrgChange[]>;
getRemoteChanges(opts?: { applyIgnore?: boolean }): Promise<OrgChange[]>;
type OrgChange = { fullName: string; type: string; state: string; filePath?: string };
```
(`hasTracking()`, `checkConflicts()` already return primitives — unchanged.)

**Remaining 3pp-data returns mirrored as owned DTOs (cheap — pure data, no private members):**
`describe(): Promise<MetadataTypeInfo[]>` (mirror of jsforce `DescribeMetadataObject`),
`createFromTemplate(...): Promise<TemplateCreateOutcome>` (mirror of `CreateOutput`).

**Escape hatch:** `getConnectionData(): Promise<ConnectionData>` — owned `{ accessToken, instanceUrl,
apiVersion, username, orgId, ... }` for consumers who must build their own jsforce `Connection` for a
capability outside the curated `ServicesOrg` surface. The build (and its jsforce dependency) lives
entirely in the consumer's space.

### Type locations (hand-authored, in the extension)
`src/owned/servicesOrg.ts`, `projectInfo.ts`, `deploy.ts` (SourceSpec/outcomes), `components.ts`
(ComponentSetInfo/ComponentInfo), `changes.ts` (OrgChange), `metadata.ts`
(MetadataTypeInfo/TemplateCreateOutcome/ConnectionData) — alongside the existing `DefaultOrgInfo` /
`WorkspaceInfo` / `FilePropertiesPlain` / `TraceFlagItem`. All feed `contract.ts`; the Effect services
and `PlainServicesApi` are typed from that one contract (existing alignment mechanism; no closure/gates).

## Status of prior work
- **Kept:** Phase 1 facade (`contract.ts`/`plainApi.ts`/`createPlainServicesApi`, the `sdkTypes.ts`
  funnel), the plain accessor `getServicesApi()` (Task 2.5). These front the new surface.
- **Retired/superseded:** the owned-closure generation + gates (Tasks 2.2–2.4) and the blocked
  entry-rollup (2.6). They answered the wrong question.
- This document supersedes `2026-06-19-owned-import-free-services-types-design.md` and its plan.
