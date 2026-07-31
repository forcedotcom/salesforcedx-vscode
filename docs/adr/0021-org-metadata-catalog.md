# Org metadata reads go through OrgMetadataCatalog

Cross-extension consumers use the services-owned `OrgMetadataCatalog` for org metadata discovery, workspace presence, SObject schema, change status, and remote source materialization. The catalog owns stable projections and cache/invalidation policy; metadata describe, source tracking, Tooling, and Metadata API services remain internal providers, while deploy, retrieve, and delete remain explicit mutation services that publish successful outcomes to the catalog operation stream.

Editor documents retain the `sf-org-metadata:` identity needed by VS Code and language tooling, but remote source bodies are stored in revision-addressed snapshots under `.sf/orgs/<orgId>/metadata-shadow`. The catalog reuses current snapshots, retains the current and two newest prior revisions, protects revisions used by open documents, partitions all observations and artifacts by org, and emits deduplicated, targeted change notifications.

Reusable catalog observations are also checkpointed as a schema-versioned, atomically published `.sf/orgs/<orgId>/metadata-catalog/catalog.json`. A catalog instance lazily hydrates metadata inventory, SObject, and source-tracking slices from the active org's checkpoint; workspace presence and all runtime coordination state are recomputed rather than restored, and invalid or unwritable checkpoints never fail catalog reads.

## Considered Options

A general VS Code `FileSystemProvider` was rejected as the public discovery API: filesystem operations cannot express metadata identity, hierarchy, provenance, workspace presence, schema projections, remote revisions, or explicit freshness without out-of-band conventions. Direct cross-extension use of topic-specific metadata services was also rejected because it duplicates state, requests, invalidation rules, and org-switch handling; keeping remote bodies only in memory was rejected because it increases memory pressure and makes stable diff/document revisions difficult.

## Consequences

The catalog is the read gateway, not the owner of every metadata workflow: consumers continue to own presentation and generated artifacts, mutation services continue to own writes, and internal providers continue to speak their native APIs. Consumers choose consistency according to the operation: navigation may reuse catalog shadow content, while user-invoked correctness-sensitive operations such as diff and conflict detection request fresh materialization directly from the org. Multi-component commands retain their operation boundary by submitting the selected group to one catalog acquisition; the catalog performs one retrieve and publishes separate revision-addressed artifacts. Background source-tracking observations improve cache freshness but do not gate those explicit operations. A successful fresh materialization updates an already-loaded inventory revision without requiring inventory discovery first.

New catalog operations and their maintenance work use Effect spans, public services API handles expose the catalog rather than its discovery providers, and the internal **SFDX: Show Org Metadata Catalog State** command opens the latest durable checkpoint for diagnosis.

See the [implementation plan](../superpowers/plans/2026-07-30-org-metadata-catalog-generalization.md) and [manual validation guide](../superpowers/manual-tests/2026-07-31-org-metadata-catalog.md).
