# Org Catalog Service Decomposition

> Historical decomposition plan. Its requirement to preserve the original facade API was superseded by the
> consumer-shaped boundary recorded in [ADR 0021](../../adr/0021-org-metadata-catalog.md): `getChildren`, batch
> `getEntries`, and batch `resolveComponents`.

**Work Item:** W-23613533
**Date:** 2026-08-03
**Status:** Complete

## Architecture Amendment — 2026-08-06

The original decomposition preserved provider-shaped acquisition methods on `OrgMetadataCatalog`. Follow-up
review clarified that the catalog is not intended to replace the existing provider APIs. The sections below
remain a record of the decomposition work, but their "sole public service" and "public contract to preserve"
requirements are superseded as follows:

- `MetadataDescribeService`, `SourceTrackingService`, and `MetadataRetrieveService` continue to own their
  acquisition APIs.
- Successful provider Effects record normalized observations through the private
  `OrgMetadataCatalogRecorder` before returning. Provider failures do not create observations.
- `OrgMetadataCatalog` exposes catalog-native hierarchy, presence, document, shadow-source, invalidation, and
  explicitly cached queries. It no longer covers source status, SObject acquisition/refresh, or download.
- Provider callers compose capture with `Effect.tap` or `Stream.tap`; the recorder exposes concrete `Effect.fn`
  methods rather than a generic higher-order accessor.
- In-memory state is updated synchronously. Materially changed observations are persisted by a scoped,
  per-runtime queue that coalesces bursts and flushes dirty orgs during shutdown.
- Snapshot version 2 adds normalized metadata-type and metadata-listing observations and migrates version 1
  snapshots with empty collections for those fields.
- Mutation providers update catalog state and provider caches before returning. The document provider no longer
  repeats operation invalidation asynchronously.

Current ownership is therefore:

```text
MetadataDescribeService ─┐
SourceTrackingService ───┼─> OrgMetadataCatalogRecorder ─> OrgCatalogState + persistence
Retrieve/Deploy ─────────┘                    └───────────> catalog change notifications

OrgMetadataCatalog ─> catalog-native projections and cached observations
```

## Problem

`orgMetadataCatalog.ts` is approximately 1,700 lines and combines public API adaptation, active-org resolution,
cache persistence, metadata inventory, workspace correlation, SObject schema, tree projection, source tracking,
retrieval, shadow materialization, document reads, invalidation, and notification publication.

The concern is not only file length. Several operations currently depend on carefully coordinated state:

- persisted inventory contains remote observations but workspace presence must be rescanned;
- inventory loads and invalidations share per-type semaphores to prevent stale writes;
- Custom Field children combine Metadata API membership with REST description details;
- tracking refresh invalidates affected inventory and SObject observations before publishing one change event;
- materialization is serialized and partitioned by org and remote revision.

The decomposition must preserve these invariants rather than divide methods solely by size.

## Goals

1. Keep `OrgMetadataCatalog` as the sole public service and preserve its exact API and generated service types.
2. Introduce acyclic internal boundaries with explicit ownership of state and locking.
3. Keep source files focused, normally below 400 lines, by extracting models and pure helpers as well as services.
4. Preserve cache, persistence, invalidation, notification, and concurrency behavior.
5. Make each data source and projection independently testable.

## Non-Goals

- Changing consumer call sites or the public `OrgMetadataCatalog` API.
- Changing freshness, retrieval, tracking, or persistence behavior.
- Exposing internal services through the services extension API.
- Adding new catalog capabilities or optimizing provider performance.
- Requiring every internal module to be an `Effect.Service`.

## Design Principles

### One public service

`OrgMetadataCatalog` remains an `Effect.Service`. Internal units should normally be factory-built modules with
explicit port interfaces. They are private implementation details and do not need independent Layer topology.

### Resolve org identity at the facade

The facade resolves the active org once at the beginning of a public operation and passes `orgId` to internal
modules. This prevents one operation from observing multiple active orgs and keeps leaf modules independent of
target-org state.

### State owns coherence

One internal state repository owns the catalog refs, hydration, persistence generations, and inventory locks.
Domain modules use semantic state operations; they do not receive raw refs. This avoids the cycle created when a
hydration service must populate caches owned by services that themselves call `ensureHydrated`.

### Projection is separate from acquisition

Metadata inventory establishes Custom Field membership and timestamps. SObject descriptions enrich those fields
with schema details. A projection module consumes both sources; neither acquisition module depends on the other.

### Invalidation uses semantic ports

Cross-domain invalidation calls operations such as `invalidateTypes`, `invalidateSObjects`, and
`removeTrackingObservations`. Inventory owns its semaphore ordering. The facade coordinates the sequence and
publishes notifications only after state is coherent.

## Public Contract to Preserve

The facade must retain the inferred signatures and behavior of all current methods, including these easily lost
details:

- `download` returns the resulting document `URI`.
- `describeSObjects` returns a `Stream`, not a materialized map.
- `getEntry` may return `undefined`.
- `getChildrenCached` may return `undefined` and does not acquire inventory.
- `refreshMetadataTypes` and `refreshMetadataComponents` return refreshed entries.
- `refreshChangeStatus` accepts local/remote status options and returns status rows.
- `getRemoteDocument` returns document identity and revision metadata, not source content.
- `read` preserves the existing workspace-versus-shadow behavior and result type.

Contract tests at the facade remain authoritative. Internal tests may be added, but existing behavioral assertions
must not be weakened or replaced by delegation-only mocks.

## Target Architecture

```text
OrgMetadataCatalog (public facade)
├── active-org resolution and public contract adaptation
├── refresh/download/tracking invalidation coordination
├── OrgCatalogState
├── OrgCatalogWorkspace
├── OrgCatalogInventory
├── OrgCatalogSObjects
├── OrgCatalogProjection
├── OrgCatalogTracking
├── OrgCatalogRemoteSource
└── OrgCatalogDocuments

Dependency direction:

OrgCatalogState ─────────────────────────────────────────────┐
OrgCatalogWorkspace ──> OrgCatalogInventory ──┐              │
OrgCatalogSObjects ───────────────────────────> OrgCatalogProjection
OrgCatalogInventory ──────────────────────────> OrgCatalogRemoteSource
OrgCatalogInventory + OrgCatalogRemoteSource ─> OrgCatalogDocuments
OrgCatalogTracking ───────────────────────────> facade coordination
all internal modules <───────────────────────── facade construction
```

No internal module depends on the facade. Inventory does not depend on SObjects, and SObjects do not depend on
Inventory.

## Internal Boundaries

### Models and pure helpers

Files:

- `orgMetadataCatalogTypes.ts`: public catalog types and schemas.
- `orgCatalogInternalTypes.ts`: inventories, persisted entries, tracking observations, and internal ports.
- `orgCatalogKeys.ts`: org/type/SObject identities.
- `orgCatalogProjection.ts`: pure folder/component projection and inventory merging.

These files contain no services or mutable state.

### OrgCatalogState

Owns:

- loaded and persisted inventory caches;
- workspace type cache;
- SObject list and description caches;
- remote tracking observations;
- hydrated org IDs and persisted generations;
- hydration semaphore and per-type inventory semaphores.

Responsibilities:

- `ensureHydrated(orgId)` and `persistOrg(orgId)`;
- semantic cache reads/writes and snapshot construction;
- org/type invalidation under inventory locks;
- retaining only remote inventory in persisted snapshots;
- never restoring workspace presence from disk.

It depends on `OrgMetadataCatalogStore` only. Provider cache invalidation remains in the facade/domain modules.

### OrgCatalogWorkspace

Responsibilities:

- scan workspace components for a metadata type;
- use `component.content ?? component.xml` for decomposed children;
- discover workspace metadata types;
- resolve consumer-known org references without Metadata API acquisition.

Dependencies: `ProjectService`, `MetadataRetrieveService`, URI codec/registry access, and `OrgCatalogState` for the
workspace-type cache.

### OrgCatalogInventory

Responsibilities:

- describe metadata types and list components/folders;
- load/coalesce type inventories;
- merge remote inventory with live workspace presence;
- get entries and presence;
- expose raw inventory to projection and remote-source modules;
- own semantic provider invalidation for metadata inventory.

Dependencies: `MetadataDescribeService`, `OrgCatalogWorkspace`, `OrgCatalogState`, and URI creation. It does not
depend on the SObject module.

### OrgCatalogSObjects

Responsibilities:

- list and describe SObjects;
- batch descriptions as a stream;
- reacquire and invalidate SObject observations;
- preserve REST provenance and timestamps.

Dependencies: `MetadataDescribeService`, `TransmogrifierService`, and `OrgCatalogState`. It does not depend on
metadata inventory.

### OrgCatalogProjection

Responsibilities:

- project roots, folder hierarchies, components, and cached children;
- combine Custom Field inventory membership with optional SObject field details;
- refresh a stale SObject description when field inventory is newer;
- preserve namespace and manageable-state behavior.

Dependencies: `OrgCatalogInventory`, `OrgCatalogSObjects`, and `OrgCatalogWorkspace`. This is the only internal
module that composes Metadata API field inventory with REST descriptions.

### OrgCatalogTracking

Responsibilities:

- report tracking availability and current status;
- compare remote observations and return a change set;
- commit/remove tracking observations through state.

It does not invalidate inventory or publish catalog notifications. `OrgMetadataCatalog.refreshChangeStatus`
coordinates: acquire status, determine changed references, invalidate affected domains, commit observations,
persist, then publish one event.

### OrgCatalogRemoteSource

Responsibilities:

- fetch readable Apex source through Tooling API;
- retrieve other metadata into staging directories;
- discover staged files and publish shadow artifacts;
- batch materialization and revision-keyed shadow reuse;
- serialize materialization.

Dependencies: Inventory, `MetadataRetrieveService`, `ComponentSetService`, `OrgMetadataShadowStore`, `FsService`,
`ProjectService`, and `ConnectionService`.

Workspace `download` is not part of this module. It remains facade coordination because it retrieves into the
project, invalidates catalog state, and returns a newly resolved document URI.

### OrgCatalogDocuments

Responsibilities:

- create and parse `sf-org-metadata` document URIs;
- reject documents for inactive orgs;
- resolve local versus virtual document URIs;
- read local content or materialize/read remote shadow content;
- return remote document identity and revision.

Dependencies: Inventory, RemoteSource, `FsService`, and registry URI helpers.

## Invalidation Invariants

The refactor must retain these sequences:

1. Full refresh invalidates provider describe/list caches and all active-org inventory/workspace-type caches.
2. Reference invalidation acquires affected type semaphores in sorted order before removing inventory.
3. Custom Object and Custom Field invalidation also clears correlated SObject list/descriptions.
4. Tracking refresh invalidates changed references before committing the new tracking observation set.
5. Persistence occurs after coordinated state mutation and before change publication.
6. Catalog notifications remain deduplicated and scoped to the active org.

## Progress

- [x] Architecture revised around shared state and an acyclic projection boundary.
- [x] Phase 1: public models/schemas, internal models/keys, and pure inventory projection extracted.
- [x] Pure projection regression tests added; facade contract generation remains unchanged.
- [x] Phase 2: shared state, hydration, persistence, generation, and inventory locking extracted.
- [x] Phase 3: Workspace and SObject acquisition modules extracted with explicit org identity.
- [x] Phase 4: inventory acquisition and tree/Custom Field projection extracted as separate modules.
- [x] Exact private error channels preserved so generated catalog types and metadata command inference remain stable.
- [x] Phase 5: staged retrieve, shadow materialization, and document/URI policy extracted.
- [x] Phase 6: tracking acquisition and observation comparison extracted; coordinated invalidation remains in the facade.
- [x] Phase 7: facade reduced to construction, active-org adaptation, invalidation coordination, and public delegation.
- [x] Phase 8 automated verification: services and consumers compile, package tests pass, and Effect diagnostics are clean.
- [x] Phase 8 manual verification: Org Browser, Apex Testing, metadata diff/download, tracking, and target-org switching.

## Implementation Phases

### Phase 0: Freeze behavior

- Record the exact inferred facade contract.
- Retain the current integration harness.
- Add characterization tests only where an invariant above lacks coverage.

### Phase 1: Extract models and pure helpers

- Move public types/schemas without changing exports from `orgMetadataCatalog.ts`.
- Move internal inventory/tracking types and key helpers.
- Move `mergeInventory` and `projectChildren` to a pure projection file.
- Run compile, lint, circular-dependency checks, Effect diagnostics, and catalog tests.

### Phase 2: Extract state and hydration

- Introduce the internal state factory and semantic cache interface.
- Move refs, hydration, snapshot construction, generation handling, and inventory locks.
- Preserve the rule that persisted inventory is remote-only and workspace presence is rescanned.

### Phase 3: Extract leaf acquisition modules

- Extract Workspace and SObject modules first.
- Pass `orgId` explicitly.
- Add focused tests using their explicit ports.

### Phase 4: Extract inventory and projection

- Move inventory acquisition/cache orchestration.
- Move root/folder/component projection separately.
- Move Custom Field fusion to the projection module.

### Phase 5: Extract remote source and documents

- Extract shadow materialization as one vertical slice.
- Extract URI/document handling after the materialization port is stable.
- Keep workspace download in the facade.

### Phase 6: Extract tracking and invalidation coordination

- Make Tracking return changed references without side effects in other domains.
- Implement coordinated invalidation and publication in the facade.

### Phase 7: Reduce the facade

- Construct internal modules from existing dependencies.
- Delegate public queries and retain coordination workflows.
- Confirm no internal implementation service is exported through services-types.

### Phase 8: Consumer and manual verification

- Compile all consumers and regenerate/check services types.
- Manually test Org Browser discovery/filter/refresh/retrieve and Custom Fields.
- Manually test Apex Testing ephemeral source/download behavior.
- Test metadata diff, workspace download, source tracking, and target-org switches.

## Testing Strategy

- Keep facade integration tests for persistence, org partitioning, overlapping invalidation, notification dedup,
  Custom Field dual-source projection, batch materialization, and freshness behavior.
- Add unit tests for pure projection and each internal module.
- Use real internal modules in facade tests; delegation-only mocks are insufficient for cache coherence.
- Run package compile, lint, circular dependencies, Effect diagnostics, services and consumer Jest suites, and
  desktop/web integration suites appropriate to changed behavior.

## Rollout

- One PR is acceptable, but each phase should be a behavior-preserving, independently testable commit.
- Do not mix new catalog features into the decomposition.
- Keep `OrgMetadataCatalog` as the compatibility boundary throughout, so partial phases remain shippable.

## Success Criteria

- The public service contract and all consumer call sites remain unchanged.
- The internal dependency graph is acyclic.
- No raw cache refs cross domain boundaries.
- Existing concurrency and invalidation tests pass without weakened assertions.
- New internal files are normally below 400 lines; exceptions require a cohesive reason, not arbitrary splitting.
- Lint, circular dependency checks, Effect diagnostics, package tests, and relevant end-to-end tests pass.

## References

- `packages/salesforcedx-vscode-services/src/orgCatalog/orgMetadataCatalog.ts`
- `packages/salesforcedx-vscode-services/src/orgCatalog/orgMetadataCatalogStore.ts`
- W-23613533 Org Metadata Catalog and Org Browser work
