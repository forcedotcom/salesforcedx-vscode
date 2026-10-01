# Org Metadata Catalog Finder API and Apex LS Migration Plan

**Date:** 2026-08-14
**Status:** Proposed
**Related work:** PR #7918, W-23613533

## Context

The new Apex language server can ask its VS Code client to locate missing artifacts. The client currently resolves those requests by composing several Salesforce Services APIs with client-owned discovery and storage logic.

The implementation is in:

```text
/Users/peter.hale/git/apex-ls-others/packages/apex-lsp-vscode-extension
```

The current resolution paths are:

| Artifact | Workspace lookup | Org lookup | Result consumed by Apex LS |
| --- | --- | --- | --- |
| Apex class | `ComponentSetService` | Direct Tooling API SOQL | Open source document |
| Apex trigger | `ComponentSetService` | Direct Tooling API SOQL | Open source document |
| SObject | `ComponentSetService`, followed by parsing object and field XML | `MetadataDescribeService.describeCustomObject` | Structured SObject description |

The handler first searches the workspace, then sends unresolved identifiers through its org lookup. Apex and trigger source returned from the org is stored in a client-owned, in-memory `apex-org-artifact:` filesystem before being opened for synchronization with the language server.

This creates several architectural problems:

- Apex LS must understand multiple services APIs and how their results relate.
- Direct Tooling API queries bypass catalog discovery and persistence.
- The client owns a second remote-source cache and virtual filesystem.
- Workspace/org presence and precedence are reconstructed outside the catalog.
- Adding catalog APIs without migrating the underlying responsibilities would leave duplicate public entry points.

This use case reinforces Shane's review feedback: when a primary metadata function moves to the catalog, the catalog should become its public owner and the overlapping entry point should be deprecated after consumers migrate. The catalog should not become a facade that permanently duplicates existing public APIs.

## Goals

1. Give consumers one narrow, batch-oriented way to find exact metadata components.
2. Make the catalog responsible for workspace/org discovery, presence, acquisition, caching, persistence, and document resolution.
3. Move Apex class and trigger lookup out of the Apex LS client.
4. Move public SObject description ownership to the catalog while preserving the distinct schema result required by Apex LS.
5. Record every successful org discovery in the catalog.
6. Migrate known consumers before deprecating overlapping services entry points.
7. Keep language-specific search semantics out of the catalog.

## Non-goals

- The catalog will not accept Apex parser hints, provenance, origin positions, request modes, or UI instructions.
- The catalog will not perform fuzzy or language-aware symbol resolution.
- The catalog will not own the Apex LS wire protocol.
- The first implementation will not define speculative workspace/org SObject merge behavior.
- This work will not deprecate broad services such as `ConnectionService` or all of `ComponentSetService` when they retain unrelated use cases.

## Proposed public boundary

### Component finder

Add one batch-only catalog operation:

```ts
findComponents(
  references: readonly OrgMetadataCatalogComponentReference[]
): Effect.Effect<readonly OrgMetadataComponentFindResult[]>;
```

The request uses exact metadata identities:

```ts
type OrgMetadataCatalogComponentReference = {
  readonly type: string;
  readonly fullName: string;
};
```

Define the request and result with Effect Schema. The result should preserve input order and distinguish an ordinary miss from an operational failure:

```ts
type OrgMetadataComponentFindResult =
  | {
      readonly status: 'found';
      readonly reference: OrgMetadataCatalogComponentReference;
      readonly presence: 'workspace' | 'org' | 'both';
      readonly documentUri: URI;
    }
  | {
      readonly status: 'not-found';
      readonly reference: OrgMetadataCatalogComponentReference;
    };
```

Contract decisions:

- `documentUri` is chosen by the catalog, using deterministic workspace-first behavior.
- A consumer does not select local versus remote storage.
- `not-found` is data; authentication, connection, acquisition, and storage failures remain in the Effect error channel.
- The catalog can deduplicate work internally, but it returns a result corresponding to every input reference.
- The initial API does not expose refresh, consistency, source preference, or fuzzy-match options. Those should be added only in response to a concrete consumer requirement.

### SObject descriptions

Add a separate, batch-only catalog operation:

```ts
describeSObjects(
  names: readonly string[]
): Effect.Effect<readonly OrgSObjectDescription[]>;
```

SObject descriptions remain a separate operation because their useful result is a semantic schema, not a document location. Apex LS needs field types, relationships, and other describe information immediately; opening a `CustomObject` metadata document does not provide an equivalent result.

This separation is about result shape, not ownership. The catalog should own both component finding and SObject description acquisition.

## Responsibility boundary

### Apex LS owns

- Interpreting `WireIdentifierSpec` and other language-server request data.
- Translating search hints into ordered exact metadata candidates.
- Choosing the first catalog match according to Apex semantic order.
- Adapting `OrgSObjectDescription` into the Apex LS wire schema.
- Adding Apex-specific definition targets and enforcing wire-size limits.
- Opening returned documents and managing blocking/background UI behavior.

### The catalog owns

- Exact workspace component lookup.
- Exact org component lookup.
- Workspace/org/both presence.
- Remote acquisition and materialization.
- Stable document URIs.
- Caching, persistence, and active-org isolation.
- Recording discovery provenance.
- SObject describe acquisition and transformation into the stable catalog schema.

## Implementation plan

### Phase 1: Define and test the finder contract

1. Add Effect Schema definitions for finder requests and results.
2. Export only the consumer-facing types needed to call the API.
3. Specify input-order preservation, duplicate handling, case behavior, namespace behavior, and error semantics.
4. Add contract tests before connecting remote acquisition.

Acceptance criteria:

- Empty and multi-reference batches are supported.
- Results align with input order.
- Duplicate references do not cause duplicate acquisition.
- Not-found results are distinguishable from service failures.
- The public API contains no Apex LS-specific fields or generic predicate mechanism.

### Phase 2: Implement catalog-owned component discovery

Implement `findComponents` as a real discovery operation rather than an alias for `resolveComponents`.

For each exact reference, the catalog should:

1. Search the workspace.
2. Consult persisted org inventory.
3. Acquire remote existence when the inventory cannot provide an authoritative answer.
4. Record newly discovered components and their provenance.
5. Calculate `workspace`, `org`, or `both` presence.
6. Return a usable document URI only for confirmed components.

`resolveComponents` currently represents a different contract: the consumer has already made an authoritative org discovery, and the catalog resolves workspace presence and records it. Keep that operation during migration. Reassess it after all consumers are using finder semantics.

### Phase 3: Move Apex source acquisition behind the catalog

1. Move exact Tooling API lookup for Apex source into the catalog's internal acquisition layer.
2. Support both `ApexClass` and `ApexTrigger`.
3. Normalize namespace-qualified and unqualified names consistently.
4. Record every successful Tooling discovery in catalog inventory.
5. Add optimized Tooling source materialization for `ApexTrigger`; the existing optimized path currently covers only `ApexClass`.
6. Retain Metadata API retrieval as an internal fallback where appropriate.
7. Return `sf-org-metadata:` URIs for org-only documents.
8. Define behavior for protected, deleted, and unavailable source.

Acceptance scenarios:

- Workspace-only class and trigger.
- Org-only class and trigger.
- Component present in both locations.
- Namespaced class and trigger.
- Missing component.
- Protected source.
- Active-org change during or between requests.
- Concurrent requests for the same component.

### Phase 4: Make the catalog the SObject description owner

1. Add `describeSObjects(names)` to the catalog.
2. Reuse the existing lower-level describe acquisition and cache initially, but place the catalog in control of the public operation.
3. Transform raw describe responses into `OrgSObjectDescription` inside services.
4. Persist descriptions and record observation provenance.
5. Ensure batch acquisition warms the same cache used by later single-name batches.
6. Decide whether the catalog should maintain generated `${sobject.name}.json` documents for stable definition locations.
7. Publish a description stream only when an identified Apex or LWC consumer is ready to consume it; do not add a speculative public stream.

Workspace SObject policy for the initial release:

- Org describe data remains the authoritative semantic schema.
- Workspace metadata can supply definition targets for locally defined objects and fields.
- Apex LS continues to adapt and attach language-server-specific definition targets.
- Workspace fields are not silently merged with org fields until reconciliation rules are documented and tested.

### Phase 5: Migrate Apex LS source lookup

In `apex-lsp-vscode-extension`:

1. Keep the existing conversion from `WireIdentifierSpec` to ordered metadata candidates.
2. Deduplicate those exact `{ type, fullName }` references.
3. Replace missing-artifact workspace `ComponentSetService` lookup for Apex classes and triggers with `OrgMetadataCatalog.findComponents`.
4. Replace direct `ConnectionService` Tooling queries with the same catalog call.
5. Select the first found result according to the original candidate order.
6. Open the returned `documentUri`.
7. Add `sf-org-metadata:` Apex class and trigger selectors to language-client document synchronization.
8. Remove Apex class and trigger content from the client-owned `OrgArtifactFileSystem` after the catalog path is proven.
9. Retain client telemetry, request correlation, and blocking/background behavior.

The resulting flow should be:

```text
Language server identifier
        |
        v
Apex LS ordered exact candidates
        |
        v
OrgMetadataCatalog.findComponents
        |
        v
Catalog-selected document URI
        |
        v
Open document and synchronize with Apex LS
```

### Phase 6: Migrate Apex LS SObject lookup

1. Replace direct `MetadataDescribeService.describeCustomObject(name)` calls with `OrgMetadataCatalog.describeSObjects([name])`.
2. Keep the Apex LS adapter that converts the catalog schema to `SObjectDescribe`.
3. Keep wire-size enforcement in Apex LS.
4. Keep Apex-specific definition-target construction in Apex LS until the shared definition-document contract is established.
5. Verify standard fields, relationship fields, custom fields, and child relationships.

### Phase 7: Provide cross-extension compatibility

Salesforce Services and Apex LS may ship independently, so migration requires a compatibility interval.

1. Add a services API capability/version check.
2. Prefer catalog APIs when present.
3. Temporarily retain the existing Apex LS implementation as a fallback for older services versions.
4. Add telemetry that distinguishes catalog and legacy resolution.
5. Establish the minimum services version that contains the complete finder and SObject behavior.
6. Remove the fallback after that version is required by Apex LS.

The compatibility fallback must be transitional. It should not become a second permanent implementation.

### Phase 8: Deprecate overlapping public entry points

Once Apex LS and the other known consumers have migrated:

1. Deprecate public `MetadataDescribeService.describeCustomObject` in favor of `OrgMetadataCatalog.describeSObjects`.
2. Deprecate overlapping public batch describe methods if the catalog fully replaces their consumer use cases.
3. Keep lower-level describe acquisition available internally to the catalog until it can be absorbed without duplication.
4. Stop documenting `ComponentSetService.getComponentSetFromProjectDirectories` as an artifact-finding mechanism.
5. Do not deprecate the entire `ComponentSetService` if component-set construction remains a distinct supported use case.
6. Do not deprecate `ConnectionService`; instead, remove direct consumer Tooling queries for catalog-owned metadata discovery.
7. Inventory remaining `resolveComponents` consumers and their discovery semantics.
8. Deprecate `resolveComponents` only if `findComponents` can satisfy every remaining authoritative-discovery case without weakening correctness.

The required sequence is:

```text
Catalog owns behavior
        |
        v
Consumers migrate
        |
        v
Legacy APIs are marked deprecated
        |
        v
Compatibility window
        |
        v
Legacy public entry points are removed
```

The catalog should not permanently implement its public operations by calling a deprecated public facade. Acquisition helpers can remain reusable internal services, but ownership and the supported public entry point move to the catalog.

### Phase 9: Validate consumers and remove duplication

Catalog tests should cover:

- Exact batch lookup and stable ordering.
- Duplicate request coalescing.
- Case and namespace behavior.
- Workspace/org/both presence.
- Cache hit and remote acquisition.
- Discovery recording and persistence.
- Active-org isolation and switching.
- Apex class and trigger materialization.
- SObject persistence and cache reuse.
- Missing, protected, authentication, and connectivity failures.

Apex LS tests should cover:

- Search hints still produce the correct ordered candidates.
- Workspace source opens through the catalog.
- Org-only source opens through `sf-org-metadata:`.
- SObject descriptions still reach the language server.
- Definition navigation remains correct.
- Missing and unavailable behavior remains compatible.
- The client no longer performs direct Tooling queries on the catalog path.
- The client no longer stores remote Apex or trigger source after fallback removal.
- The compatibility fallback works only with older services versions.

## Delivery slices

1. Add `findComponents` contract and catalog-owned Apex class/trigger discovery.
2. Add complete Apex class/trigger document materialization.
3. Migrate the Apex LS source lookup with a temporary compatibility fallback.
4. Add catalog-owned `describeSObjects`.
5. Migrate Apex LS SObject lookup.
6. Migrate other known describe consumers.
7. Mark overlapping public APIs deprecated.
8. Reassess and potentially deprecate `resolveComponents`.
9. Remove Apex LS compatibility code and obsolete client-owned remote storage.

## Open decisions

1. Should a found result expose `presence` directly, or should consumers that need presence obtain it through catalog entries while finder returns only `documentUri`?
2. Should protected source be represented as a found component whose document cannot be read, or as a distinct typed finder result?
3. Is workspace-first always correct, or does an existing consumer require a different deterministic rule? Do not add a preference option without that consumer evidence.
4. Should generated SObject definition JSON be a catalog document, an Apex LS document, or eventually unnecessary once workspace and org definition targets have a shared representation?
5. Which current `MetadataDescribeService` consumers must migrate before deprecation can begin?
6. Does Test Explorer's authoritative org discovery remain a distinct reason to keep `resolveComponents`, or can it be expressed as a finder request without repeating remote discovery?

## Completion criteria

The work is complete when:

- Apex LS uses the catalog for Apex class and trigger discovery and documents.
- Apex LS uses the catalog for SObject descriptions.
- Direct Tooling discovery and client-owned remote Apex source storage are removed from the supported path.
- All successful discoveries are reflected in catalog state.
- Known consumers have migrated from overlapping describe and discovery APIs.
- Deprecated entry points have an explicit removal window.
- The catalog public surface reflects concrete consumer needs and contains no speculative search mechanism.
