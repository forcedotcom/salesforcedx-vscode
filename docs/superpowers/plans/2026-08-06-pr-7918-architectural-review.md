# PR 7918 Architectural Review Response

> Historical remediation plan. Public API preservation in this document was superseded by the consumer-shaped
> boundary recorded in [ADR 0021](../../adr/0021-org-metadata-catalog.md).

**Work Item:** W-23613533  
**Date:** 2026-08-06  
**Status:** Implemented; ready for review

## Implementation Progress

- [x] Replaced dependency-bearing catalog factories with private `Effect.Service` implementations.
- [x] Made catalog state, hydration, persistence generations, and inventory locks layer-owned.
- [x] Reduced `OrgMetadataCatalog` to orchestration and delegation over the internal services.
- [x] Added verified connection acquisition for a captured org and propagated expected-org identity through catalog
      Metadata Describe, Metadata Retrieve, Tooling, REST SObject, and source-tracking acquisition paths.
- [x] Prevented mismatched acquisition failures from committing inventory or persistence state.
- [x] Moved document URI construction/parsing behind a registry-backed metadata-reference service.
- [x] Removed the fabricated `.xml` suffix for registry-unknown metadata and added registered-`xml` round-trip coverage.
- [x] Kept org IDs as validated direct path segments while preserving URI encoding for metadata names.
- [x] Made semaphore composition pipeable and removed the generic service accessor reported by Effect diagnostics.
- [x] Converted catalog-specific errors introduced by this work to `Schema.TaggedError`.
- [x] Passed Services compilation, test compilation, lint/circular checks, focused catalog tests, and Effect diagnostics.
- [x] Passed compilation for Org Browser, Apex Testing, Metadata, and SOQL consumers.
- [x] Passed Org Browser, Apex Testing, Metadata, and SOQL unit suites.
- [x] Passed all 374 Services Jest assertions; the aggregate command subsequently encountered a post-suite Azure
      Monitor/Jest VM shutdown error under Node 22 after Jest reported all suites green.

## Summary

The review of PR 7918 contains ten threads and twelve comments. Two outdated threads are already addressed by the
current branch: metadata document suffixes come from the SDR registry, and metadata references use Effect schemas.

The remaining feedback warrants architectural rework. The public `OrgMetadataCatalog` model remains sound, but its
private decomposition uses factory option bags as manual dependency injection. Stateful and dependency-bearing
catalog capabilities should instead be private `Effect.Service` implementations with declared layers and yielded
dependencies. The refactor must also complete the operation-scoped org consistency that the current `orgId`
parameters attempt to provide.

## Review Disposition

### Already addressed

- [Use the SDR registry for metadata extensions](https://github.com/forcedotcom/salesforcedx-vscode/pull/7918#discussion_r3677679493):
  `orgMetadataReference.ts` now resolves suffixes through `RegistryAccess`.
- [Use Schema structs and derived guards](https://github.com/forcedotcom/salesforcedx-vscode/pull/7918#discussion_r3677684447):
  metadata references are `Schema.Struct` values and the component guard is derived with `Schema.is`.

These threads can be resolved after their existing tests are confirmed.

### Requires architectural rework

- [Clarify why org IDs are passed through internals and complete org consistency](https://github.com/forcedotcom/salesforcedx-vscode/pull/7918#discussion_r3722186222).
  The current design partitions state by the captured org ID, but Tooling and Metadata API operations can still
  acquire a later default-org connection and write its results into the earlier partition.
- [Replace factory-based dependency injection with Effect services](https://github.com/forcedotcom/salesforcedx-vscode/pull/7918#discussion_r3722569870).
- [Yield services instead of passing infrastructure as parameters](https://github.com/forcedotcom/salesforcedx-vscode/pull/7918#discussion_r3722599318),
  following the repository's params-versus-dependencies guidance.
- [Make the state repository an Effect service](https://github.com/forcedotcom/salesforcedx-vscode/pull/7918#discussion_r3722682117)
  so its Refs, hydration, persistence generations, and semaphores have one layer-owned lifetime.
- [Remove ambiguous `.xml` fallback behavior](https://github.com/forcedotcom/salesforcedx-vscode/pull/7918#discussion_r3722241688).
  Registry-unknown metadata needs a distinct, round-trippable identity without pretending SDR can materialize it.

### Localized cleanup

- [Construct independent dependencies concurrently](https://github.com/forcedotcom/salesforcedx-vscode/pull/7918#discussion_r3722218456)
  where the layer graph does not already provide concurrency.
- [Do not URI-encode Salesforce org IDs](https://github.com/forcedotcom/salesforcedx-vscode/pull/7918#discussion_r3722262277);
  validate them as path-safe identifiers instead.
- [Make semaphore guards pipeable](https://github.com/forcedotcom/salesforcedx-vscode/pull/7918#discussion_r3722644276)
  and use them as the final step of the guarded state update pipe.

## Architectural Changes

### Private Effect services

Convert every stateful or dependency-bearing catalog factory into a private `Effect.Service` with
`accessors: true`, declared `dependencies`, and `Effect.fn` methods:

- catalog state and locking;
- workspace correlation;
- metadata inventory;
- SObject acquisition and enrichment;
- tree projection;
- metadata reference and document URI handling;
- remote Metadata API retrieval;
- remote source materialization;
- document projection;
- source-tracking observations.

Pure functions in the projection, key, and identity modules remain ordinary functions. Runtime inputs such as an
org ID, metadata reference, consistency request, or refresh target remain method parameters. Refs, semaphores,
PubSubs, filesystem access, registry access, connection access, and other services are yielded from context.

`OrgMetadataCatalog` becomes a thin public facade that:

1. establishes the active-org operation context;
2. delegates to the appropriate internal service;
3. coordinates cross-capability invalidation, persistence, and notification ordering; and
4. exposes the existing consumer-facing API.

The internal services are not exported through the Services extension API or generated consumer types. Production
and test layer composition must ensure all internal services share one `OrgCatalogState` instance.

### Pinned active-org operations

The catalog remains an active-org API rather than becoming a public concurrent multi-org API. Each public operation
captures the active org ID once and treats it as runtime operation data.

Complete this guarantee as follows:

- Add verified-org connection acquisition to `ConnectionService`: acquire a connection and confirm its auth-info
  org ID equals the expected operation org ID.
- Add an optional expected-org input to the Metadata Describe, Metadata Retrieve, and source-tracking acquisition
  methods used by the catalog. Existing callers can omit it.
- Tooling API reads acquire a verified connection for the operation org.
- Metadata API inventory, REST SObject describe, Metadata API retrieval, Tooling source, and source-tracking reads
  all use an org-verified connection before returning data to the catalog.
- Before committing remotely acquired data, verify that it still belongs to the captured org. On mismatch, fail
  with a typed inactive-org operation error and do not write into another org's inventory, tracking, persistence,
  or shadow partition.
- A request already running on a captured connection may finish for the old org, but its data can only be stored in
  that old org's partition. It must never be attributed to the newly active org.

This preserves the existing per-org cache, persistence, and shadow layout while closing the mixed-org race identified
in review.

### Metadata references and document URIs

Create a private metadata-reference service that depends on `MetadataRegistryService` and owns URI construction and
parsing.

- For registry-supported metadata, append the registered SDR suffix so editor and language features receive the
  expected filename.
- For registry-unknown metadata, append no fabricated source suffix. The component remains discoverable in catalog
  inventory, but the catalog does not promise SDR retrieval or language support for it.
- Parsing removes a suffix only when the registry supplies that exact suffix. A real registered `xml` suffix and a
  full name already ending in `.xml` therefore round-trip without ambiguity.
- Validate the org ID as a non-empty, path-safe Salesforce identifier and place it directly in catalog, document,
  persistence, and shadow paths.
- Continue encoding metadata full-name path segments because foldered metadata may contain `/` and other URI-significant
  characters.

The existing `sf-org-metadata:` scheme remains the editor-facing document boundary.

### Effect conformance cleanup

- Change `withInventorySemaphores` into a data-last, pipeable helper.
- Resolve independent service construction with `Effect.all` where it is not already handled by Layer composition.
- Convert new catalog error classes from `Data.TaggedError` to `Schema.TaggedError`, including a specific inactive-org
  operation error carrying expected and observed org IDs.
- Run the repository's Effect review workflow after refactoring and address confirmed service, dependency, error,
  and composition findings rather than suppressing them.

## Interfaces and Compatibility

- Preserve all current `OrgMetadataCatalog` method names and consumer call patterns.
- Add optional expected-org options only to the affected lower-level acquisition methods so existing non-catalog
  callers remain source-compatible.
- Keep internal catalog services private to `salesforcedx-vscode-services`.
- Preserve supported `sf-org-metadata:` URI shapes except for unnecessary org-ID escaping.
- Registry-unknown metadata URIs no longer receive a fabricated `.xml` suffix.
- Preserve catalog snapshot version 1 unless the serialized shape changes. If an org-ID type brand is introduced,
  keep its encoded representation as the existing string so no snapshot migration is required.

## Test Plan

### Service architecture

- Verify each internal service can be provided with test layers for its dependencies.
- Verify the complete internal live layer shares one catalog-state service and one set of locks.
- Verify the public catalog facade delegates without exposing internal services in generated consumer types.

### Org consistency

- Switch target org while Metadata API inventory is in flight; no component from the new org is stored under the old
  org ID.
- Repeat the race for REST SObject describe, Tooling Apex source, Metadata API shadow retrieval, and source tracking.
- Verify a mismatched connection fails with the typed inactive-org error before catalog mutation.
- Verify an operation completed with the old org's captured connection can only update the old org partition.
- Preserve restart hydration and target-org partition isolation tests.

### URI behavior

- Round-trip Apex classes, triggers, foldered metadata, and a registry type whose suffix is `xml`.
- Round-trip a full name already ending in `.xml` without truncation.
- Round-trip registry-unknown metadata without adding or stripping `.xml`.
- Reject malformed schemes, missing path segments, invalid org IDs, and mismatched suffixes.
- Verify org IDs are not percent-encoded while metadata full-name segments remain safely encoded.

### Regression coverage

- Run the Services catalog, store, shadow, notification, retrieve, describe, and tracking suites.
- Run Org Browser hierarchy/filter/refresh tests, Apex Testing navigation and download reconciliation tests, Metadata
  diff/conflict/SObject tests, and SOQL discovery/completion tests.
- Run Services and consumer compilation, lint, circular-dependency checks, generated service types, Effect diagnostics,
  package-lock validation, and full repository pre-commit and pre-push workflows.

## Acceptance Criteria

- No catalog module receives an Effect service, Ref, PubSub, semaphore, registry instance, or filesystem service through
  a factory options object.
- `OrgMetadataCatalog` remains the only public catalog service consumed by other extensions.
- A target-org change cannot cause remote data to be written into the wrong org partition.
- Registry-unknown metadata remains discoverable without a misleading `.xml` document suffix.
- Existing Org Browser, Apex Testing, Metadata, and SOQL behavior remains intact.
- All review threads have an evidence-backed response and are resolved only after their corresponding tests pass.

## Assumptions

- Pinned operation semantics are the default: target changes must never mix data between org partitions.
- Full concurrent multi-org execution is out of scope.
- Registry-unknown metadata is inventory-only unless a future provider adds an explicit materialization strategy.
- The two outdated review threads require confirmation and resolution, not further implementation changes.
