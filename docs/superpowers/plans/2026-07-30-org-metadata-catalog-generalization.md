# Unified OrgMetadataCatalog Plan

**Status:** Implemented with a consumer-shaped public boundary
**Work item:** W-23613533

## Summary

Make `OrgMetadataCatalog` the shared index of metadata already observed through metadata-owning services. Its public
surface is limited to the three operations required by current consumers: hierarchy reads, batch entry reads, and
batch resolution of consumer-discovered components. Specialized services continue to own acquisition and report
successful observations to the catalog.

Deploy, retrieve-to-project, and delete remain mutation services. Their successful outcomes publish events that update the catalog.

## Progress

### Completed and manually proven

- `OrgMetadataCatalog` is the shared read boundary for Org Browser inventory, hierarchy, and workspace presence.
- Apex Testing uses catalog presence and `sf-org-metadata:` documents for org-only tests.
- An org-only Apex test can be opened, downloaded, and replaced by its workspace representation without:
  - leaving stale navigation references;
  - duplicating the test in Test Explorer; or
  - rebuilding and collapsing the complete Test Explorer tree.
- Org Browser populates from catalog-backed discovery after a fresh scratch-org deployment.
- Metadata types absent from the local SDR registry remain navigable with an `.xml` document fallback.
- Successful deploy, retrieve, and delete operations publish deduplicated operation envelopes and selectively invalidate catalog observations.
- Workspace file bursts are coalesced, shadow-store changes are ignored, and Apex test presence changes use targeted tree updates.
- Metadata describe, source tracking, Tooling, deploy, and retrieve services report successful discoveries and
  mutations into the catalog without exposing their provider-shaped APIs on the catalog.
- Remote artifacts can be stored in a revision-addressed, schema-validated shadow store while remaining editor-facing `sf-org-metadata:` documents.
- Catalog contract tests cover:
  - concurrent equivalent request coalescing and cached reads;
  - metadata/workspace presence merging and remote timestamps;
  - explicit refresh and targeted metadata/SObject invalidation;
  - Custom Object/Custom Field correlation;
  - projection schemas and provider isolation; and
  - per-org inventory, document identity, source-tracking observation, and shadow revision isolation;
  - immediate rejection of document URIs belonging to the previously active org; and
  - concurrent reuse of an existing remote revision with separate materialization for a newer revision;
  - Custom Field operation notification through parent SObject invalidation and description reacquisition;
  - SObject describe observations recorded by `MetadataDescribeService` while existing artifact consumers retain
    ownership of their generation workflow;
  - SOQL object and field placeholder expansion from catalog summaries and SObject descriptions;
  - tracking conflicts using `SourceTrackingService` and non-tracking deploy conflicts using catalog timestamps,
    with both paths retrieving comparison files through the metadata extension;
  - bounded shadow revision pruning, open-document preservation, and cleanup-failure tolerance.
- Non-tracking deploy conflict detection now screens catalog timestamps before materialization and requests remote
  source only for candidate components; unchanged components produce no shadow retrieval.
- Explicit diff and conflict operations request fresh materialization through `MetadataRetrieveService`; successful
  provider calls report their observations back into the catalog.
- Multi-component diff and conflict requests retain one metadata-extension operation boundary and one Metadata API
  retrieve, then split results into component-specific comparison pairs.
- Per-org/type inventory acquisition now coalesces concurrent equivalent requests.
- Workspace notifications produced by metadata operations are correlated against the operation's complete source,
  sidecar, and bundle file set. Matching filesystem events are suppressed while unrelated and later manual changes
  remain visible to catalog consumers.
- Source-tracking polling compares revision-bearing remote observations per org, invalidates only changed component
  references, publishes one catalog change batch, and suppresses unchanged polls and operation-covered removals.
- `MetadataDescribeService` retains its existing consumers and records successful SObject discovery into the catalog;
  no duplicate SObject acquisition API is exposed on `OrgMetadataCatalog`.
- Shadow publication retains the current and two newest prior revisions per org/component, preserves additional
  revisions used by open editor documents, and treats cleanup as observable best-effort maintenance.
- [ADR 0021](../../adr/0021-org-metadata-catalog.md) records the catalog gateway, operation-stream, revision,
  shadow-store, retention, and public API boundary decisions.
- Catalog inventory, SObject, and source-tracking observations are checkpointed per org in a schema-versioned,
  atomically published JSON file. Catalog startup lazily hydrates valid checkpoints, recomputes workspace presence,
  and exposes the durable state through an internal inspection command.

### Remaining

- Complete the [OrgMetadataCatalog manual validation suite](../manual-tests/2026-07-31-org-metadata-catalog.md),
  including diff/conflict, Refresh SObjects, SOQL discovery, Custom Field invalidation, repeated shadow reuse,
  retention, notification deduplication, and org switching.

## Public API and Data Model

- Retain the public name `OrgMetadataCatalog`.
- Expose only methods exercised by current cross-extension consumers.
- Keep local/remote selection inside catalog resolution. Consumers receive a preferred URI plus explicit workspace
  and org URIs for presentation needs; they do not choose a remote-materialization API.
- Use batch boundaries for component entry and resolution calls; callers pass an array of one for a single component.
- Return catalog-owned Effect Schema projections rather than raw Connection, SDR, or source-tracking results.
- Give projections common observation metadata: org ID, observation time, provenance, and remote modification timestamp when available.
- Correlate Custom Object metadata and runtime SObject schema without treating their representations as interchangeable.

Current API:

```ts
getChildren(reference?, options?)
getEntries(references, options?)
resolveComponents(references)
```

`getChildren` returns workspace/org presence as part of each entry. `getEntries` is the batch lookup used by metadata
conflict detection. `resolveComponents` is the reporting edge for discoveries made outside the catalog (currently
Apex Test Explorer): it records the discovery and returns a workspace-first URI, materializing an org-only document
when necessary.

## Catalog Internals

- Keep specialized acquisition in the owning services:
  - Metadata API describe/list;
  - REST SObject global/individual/batch describe;
  - Tooling API tests and lightweight Apex source;
  - workspace `ComponentSet` inventory;
  - source tracking and non-tracking revision comparison;
  - Metadata API source-format retrieval.
- Maintain per-org observations keyed by projection, identity, folder, API version, and applicable project configuration.
- Coalesce concurrent equivalent requests and batch missing SObject descriptions.
- Acquire only the hierarchy projection requested by `getChildren`:
  - org-browser roots fetch types only;
  - tree expansion fetches one type;
  - Custom Object expansion fetches one object schema;
  - Apex Testing reports its Tooling discovery through `resolveComponents` and receives primary documents;
  - metadata diff/retrieve remains owned by the metadata extension and reports successful results through the
    metadata services' recorder integration.
- Preserve `remoteLastModifiedDate` from Metadata API list/retrieve results.
- Track the revision represented by a materialized shadow artifact separately from the newest known remote revision.

## Shadow Artifact Storage

- Keep `sf-org-metadata:` as the stable editor-facing URI.
- Add a services-owned shadow store under `.sf/orgs/<orgId>/metadata-shadow`.
- Persist source-format artifacts and a schema-validated manifest containing:
  - metadata identity;
  - primary document path;
  - all component artifact paths;
  - observed remote revision;
  - materialization time and provenance.
- Store descriptors in catalog memory, not source bodies.
- On document reads:
  1. resolve the logical URI;
  2. compare known remote and materialized revisions;
  3. reuse a fresh artifact or materialize a replacement;
  4. read the backing file through the content provider.
- Write through a staging directory and atomically publish completed snapshots.
- Ignore shadow-root file events when processing workspace changes.
- Keep old snapshots long enough for active diff/file consumers; clean abandoned generations separately from freshness decisions.
- Preserve two fidelity levels:
  - lightweight primary-document materialization, allowing the current Tooling Apex path;
  - complete Metadata API source-format materialization for bundles, metadata XML, and diff.

## Synchronization and Change Discovery

- Replace deploy-only notifications with a neutral services-owned metadata operation stream containing org ID, operation, completion time, affected references, change type, paths, and server file properties when available.
- Have deploy, retrieve, and delete services publish only successful component outcomes.
- Publish one operation envelope per mutation, deduplicating source/meta and bundle file responses by metadata identity.
- Coalesce workspace watcher bursts before invalidating the catalog and notifying consumers.
- Let the catalog update or invalidate affected entries, parents, type listings, schema descriptions, and shadow revisions.
- Resolve workspace events to component identities and invalidate only affected presence observations.
- Use source-tracking polling for external changes in tracking orgs.
- Use explicit catalog refresh and server timestamps for non-tracking orgs.
- Move reusable non-tracking timestamp history/comparison into services; retain conflict UI and command orchestration in the metadata extension.
- Invalidate Custom Object/SObject schema observations when Custom Object or Custom Field operations occur.
- Partition all state by org and close/invalidate logical documents when the active org changes.

## Consumer Migration

1. Complete the existing org-browser and Apex Testing catalog integrations.
2. Move Refresh SObjects discovery to catalog list/describe methods while leaving faux Apex, TypeScript, SOQL artifact generation, progress, cancellation, and completion reporting in `salesforcedx-vscode-metadata`.
3. Move SOQL object and field discovery to catalog methods.
4. Move metadata diff/conflict remote materialization and change reads behind the catalog.
5. Move remaining direct metadata discovery consumers incrementally.
6. Deprecate and remove topic-specific discovery services from the cross-extension Services API after all callers migrate; retain them internally as catalog providers.
7. Update the catalog ADR to document the broader gateway, revision model, and disk-backed shadow store.

## Test Plan

- Unit-test every projection schema and provider-to-projection mapping.
- Verify metadata timestamps survive inventory merging.
- Verify REST schema and Metadata API observations correlate without overwriting provenance.
- Verify requests do not invoke unrelated providers.
- Verify concurrent equivalent requests share one API call.
- Verify explicit refresh bypasses cached observations.
- Verify bulk SObject descriptions remain streamed and batched.
- Verify successful deploy/retrieve/delete events update only affected catalog scopes.
- Verify shadow writes do not trigger catalog self-invalidation.
- Verify fresh shadow artifacts avoid API calls and stale revisions rematerialize.
- Verify companion metadata and bundle files remain available.
- Verify org switching isolates observations and artifacts.
- Add consumer integration coverage for org-browser, Apex Testing, Refresh SObjects, SOQL, and metadata diff/conflict.
- Manually validate:
  - opening an org-only Apex test through `sf-org-metadata:`;
  - repeated opens reuse disk-backed content;
  - download-to-workspace flips presence;
  - Refresh SObjects forces fresh schema discovery;
  - Custom Field changes invalidate object schema;
  - a later diff does not damage an already-open remote document.

## Assumptions

- Catalog-only access applies to reads, discovery, change status, and remote materialization—not mutation commands.
- Normal reads are cached/read-through; consumers explicitly request refresh.
- Generated Refresh SObjects artifacts remain owned by the metadata extension.
- External changes in non-tracking orgs require explicit refresh.
- Existing low-level services remain during gradual migration but cease being public consumer APIs at completion.

## Implementation Notes

The initial implementation now includes:

- catalog-owned metadata, SObject, and source-tracking projections with observation metadata;
- explicit cached and refresh APIs for metadata inventory, SObjects, and change status;
- a revision-addressed, schema-validated shadow store under `.sf/orgs/<orgId>/metadata-shadow`;
- lightweight Apex document materialization and complete source-format materialization;
- filtering that prevents shadow writes from invalidating workspace inventory;
- successful deploy, retrieve-to-project, and delete outcomes feeding selective catalog invalidation;
- revision-aware source-tracking observations feeding selective catalog invalidation without repeated refresh events;
- catalog-backed Refresh SObjects, SOQL discovery, Apex test workspace presence, metadata diff, and conflict reads;
- removal of the public metadata discovery and SObject transformation service handles after downstream migration;
- bounded per-component shadow retention that protects revisions backing open editor documents.
