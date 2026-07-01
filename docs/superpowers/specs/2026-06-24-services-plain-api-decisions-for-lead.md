# Services Plain API — Decision Summary (for lead review)

W-22419571. Concise rationale for the current `salesforcedx-vscode-services` plain-API shape.
Canonical detail: [ADR-0021](../../adr/0021-services-data-only-boundary.md) (decision record),
[full argument + plan](2026-06-22-services-data-only-boundary-argument-and-plan.md) (Parts 1–4).

## Goal

Let any extension (1PP or 2PP) consume the services API **without installing deps it doesn't want** — chiefly the Salesforce SDK (`@salesforce/core`, `source-deploy-retrieve`, `source-tracking`, `templates`, jsforce) **and `effect`**. Strong types, no transitive dep burden, no version coupling.

## Why the old shape failed (the trilemma)

Old API loaned **live 3pp instances** across the extension boundary: `Connection`, `SfProject`, `ComponentSet`, `DeployResult`/`RetrieveResult`, jsforce `DescribeMetadataObject`, `CreateOutput`.

To type those, a consumer has only 3 options — none work:

1. **Share an owned type** — only works for types *we* own; these are foreign.
2. **Re-declare the foreign shape** — never nominally assignable to the original. TS compares `private` members by *declaring class*, so a hand-copied `Connection` ≠ `@salesforce/core`'s `Connection`. Hard ceiling, not a tooling gap.
3. **Import the real foreign type** — works, but forces the SDK install + exact-version coupling. The thing we're trying to avoid.

No 4th option. → can't give strong types without the SDK while the surface references foreign types.

### Rejected alternative: generate the SDK type closure

Earlier spike: bundle/re-export the SDK `.d.ts` closure (dts-bundle-generator / api-extractor). **Rejected** — fixes tooling, not the trilemma: a generated `Connection` is still nominally distinct (option 2 ceiling), so consumers still need the real SDK. Also dragged transitive deps (zod, pino, memfs) + non-deterministic output. The whole closure apparatus was retired.

## Decision: data-only boundary

API exposes **owned data only**. Two shapes:

- **"do this, return data"** — action methods return hand-authored owned DTOs.
- **"give me data to build my own"** — e.g. `getConnectionData()` returns `{accessToken, instanceUrl, apiVersion, username, orgId}`; consumer builds its own `Connection` with its *own* SDK dep.

No live 3pp instance crosses the boundary. Import-free surface then **falls out for free** — nothing left to reference foreign types.

Owned types live in `src/owned/*.ts`, import nothing (SDK/jsforce/effect). Guarded by `test/jest/owned/ownedTypes.test.ts`. Owned DTOs today: `servicesOrg`, `projectInfo`, `deploy` (SourceSpec/DeployOutcome/RetrieveOutcome/FileResponseInfo), `components` (ComponentSetInfo + OwnedMetadataMember), `changes` (OrgChange), `metadata` (MetadataTypeInfo/ConnectionData/TemplateCreateOutcome).

3pp→owned mapping lives **inside the service impls** (`*Mapper.ts`, the only owned-dir files allowed SDK *type* imports) — same model as the existing `getTargetOrgInfo`→`DefaultOrgInfo`.

### Why `effect` matters here too

`effect` is an impl detail, not a consumer concern. A 2PP shouldn't need it to call a service. The plain Promise API (`PlainServicesApi`) wraps every Effect service method as a `Promise`-returning fn. Owned DTOs are plain TS `type`s — zero effect. So the data-only surface is effect-free as well as SDK-free.

## The hard part: `with*` / shifting functionality into services

A pure DTO return covers "read data." It does **not** cover "I need to *operate* on the org" (query, DML, deploy) — which previously meant loaning the consumer a live `Connection`/`ComponentSet`.

Resolution — **the loan pattern + push orchestration into services**:

- `withDefaultOrg(org => …)` — lends a services-**owned** `ServicesOrg` facade (curated `query`/`singleRecordQuery`/`create`/`update`/`delete`/`request`/`identity`/`apiVersion`, `{tooling?}` as a flag), **never** a raw `Connection`. The callback runs the consumer's logic against owned ops; the live `Connection` stays inside services.
- Build→deploy/retrieve orchestration **moved into services**, behind spec-based methods: `deployFromSource(spec)`, `retrieveToSource(spec, opts)`, `retrieveRemoteChanges()`, `retrieveMembers(members)`, `describeProjectComponents(spec)`. Consumers pass a `SourceSpec` (`paths` / `manifest` / `projectDirectories`) and get owned outcomes. The `ComponentSet` is built, conflict-checked-adjacent, deployed, and mapped **all inside services** — it never crosses out.

This is the real cost of the boundary: functionality that *used* to live in consumers (holding a ComponentSet, calling `conn.tooling.query`) shifted **into the services extension**. Trade-off accepted: services owns the heavy deps (per ADR-0008) and the orchestration; consumers stay thin + dep-free.

### Irreducible case (validated the model)

apex-testing's `new TestService(connection)` (from `@salesforce/apex-node`) genuinely needs a raw `Connection`. Handled by the **"build your own"** path: apex-testing calls `getConnectionData()` and reconstructs a `Connection` in its *own* dep space — same platform-aware construction services uses (desktop: username-backed/refreshing; web: access-token). The boundary holds; the consumer owns the SDK it actually needs.

## Status & deliberate exceptions

- **Migrated** off the loaned-instance getters: apex-testing, metadata (deploy/retrieve/delete cmds), org-browser, lwc, lightning, visualforce, apex-log, apex-oas, soql, apex-replay-debugger, core (`getUserId`).
- **Import-free published entry shipped**: `salesforcedx-vscode-services-types/owned` (OwnedServicesApi + DTOs + helpers + ICONS), proven by a consumer fixture that type-checks with **no SDK/effect installed** + a real-tsc conformance guard so the hand-authored type can't drift.
- **Removed**: 3 consumer-free deprecated getters.
- **Retained on purpose** (not data-only — tracked, gated on their consumers migrating):
  - core `WorkspaceContext.getConnection()` + `getAuthFields()` — **published 2PP backward-compat** API; changing them breaks external consumers.
  - conflict detection (timestamp strategy + `diffHelpers`) — needs SDR path-resolution (`getComponentFilenamesByNameAndType`) owned data can't express.
  - `deployOnSaveService` + delete-marked-`ComponentSet` deploy — still use the `deploy(componentSet)` getter.

A deprecated getter is removed only when it reaches **0 consumers**. Migration is incremental + non-breaking (add owned method → deprecate getter → migrate consumers → remove).

## Net for consumers

- Strong types, no SDK install, no `effect` install, no version coupling.
- "Operate on the org" via the loan (`withDefaultOrg`) or spec-based action methods.
- Escape hatch (`getConnectionData()` + own SDK) for the rare raw-instance need.
- Cost borne by services: owns heavy deps + the build/deploy orchestration that left the consumers.
