# Org metadata reads go through OrgMetadataCatalog

Cross-extension consumers use the services-owned `OrgMetadataCatalog` for metadata hierarchy, workspace/org
presence, and resolution of consumer-discovered components. The public facade exposes only `getChildren`, batch
`getEntries`, and batch `resolveComponents`. Metadata describe, source tracking, Tooling, and Metadata API services
retain their acquisition APIs and report successful observations to the catalog recorder; deploy, retrieve, and
delete remain explicit mutation services that publish successful outcomes to the catalog operation stream.

Editor documents retain the `sf-org-metadata:` identity needed by VS Code and language tooling, but remote source bodies are stored in revision-addressed snapshots. The catalog reuses current snapshots, retains a bounded number of recent revisions, protects revisions used by open documents, partitions all observations and artifacts by org, and emits deduplicated, targeted change notifications.

Reusable catalog observations are also checkpointed as a schema-versioned, atomically published per-org snapshot. A catalog instance lazily hydrates metadata inventory, SObject, and source-tracking slices from the active org's checkpoint; workspace presence and all runtime coordination state are recomputed rather than restored, and invalid or unwritable checkpoints never fail catalog reads.

## Considered Options

A general VS Code `FileSystemProvider` was rejected as the public discovery API: filesystem operations cannot express metadata identity, hierarchy, provenance, workspace presence, schema projections, remote revisions, or explicit freshness without out-of-band conventions. Direct cross-extension use of topic-specific metadata services was also rejected because it duplicates state, requests, invalidation rules, and org-switch handling; keeping remote bodies only in memory was rejected because it increases memory pressure and makes stable diff/document revisions difficult.

## Consequences

The catalog is an index, not the owner of every metadata workflow: consumers continue to own presentation and
generated artifacts, mutation services continue to own writes, and metadata services continue to speak their native
APIs. Org Browser reads hierarchy and presence from the catalog. Apex Test Explorer reports its Tooling-discovered
classes through one batch `resolveComponents` call and receives workspace-first document resolution, including an
ephemeral org document for org-only tests. Metadata diff and retrieve stay in the metadata extension; their provider
calls report successful discoveries back into the catalog. SObject artifact generation likewise remains with its
existing consumer while `MetadataDescribeService` records its successful list and describe observations.

New catalog operations and their maintenance work use Effect spans, public services API handles expose the catalog rather than its discovery providers, and the internal **SFDX: Show Org Metadata Catalog State** command opens the latest durable checkpoint for diagnosis.

See the [implementation plan](../superpowers/plans/2026-07-30-org-metadata-catalog-generalization.md) and [manual validation guide](../superpowers/manual-tests/2026-07-31-org-metadata-catalog.md).
