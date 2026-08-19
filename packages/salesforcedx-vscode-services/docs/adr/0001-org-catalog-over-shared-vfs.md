# Use a read-only org metadata catalog and document scheme instead of a shared VFS

## Status

Proposed

## Context

Org Browser and Apex Testing both need information about metadata that exists in the
active org and whether the same component exists in the workspace. Apex Testing also
needs to open source for an org-only class in VS Code without first retrieving that
class into the project.

The designs explored in PRs 7912 and 7914 used a services-provided virtual filesystem
as both the shared data structure and the VS Code integration point. That creates an
ownership problem:

- If a single extension owns writes, services needs a registration or owner-authority
  mechanism to decide which extension may populate each part of the filesystem.
- If write methods are exported through the services extension API, every consumer can
  call them. TypeScript visibility cannot enforce that only the intended logical owner
  writes a particular subtree.
- Allowing multiple writers makes cache coherence, lifecycle, and conflict resolution
  responsibilities part of the shared service.
- Requiring consumers to populate a shared filesystem couples their domain-specific
  discovery logic to a common storage and hierarchy model.

Those costs are not required to solve the editor integration problem. VS Code can open
ephemeral content from a registered URI scheme using a `TextDocumentContentProvider`.
The Apex language support extension already uses this pattern for standard Apex class
definitions whose source is read from a bundled archive. Filesystem operations and
write semantics are not prerequisites for navigation, language selection, CodeLens,
or opening a text editor.

The consumers also need different projections of the same underlying facts:

- Org Browser presents metadata types, folders, components, and workspace/org presence.
- Apex Testing discovers runnable tests through the Tooling Test Discovery API and
  presents namespaces, packages, classes, and methods through the VS Code Test API.

A shared read model can serve both without owning either projection.

## Decision

Services owns an `OrgMetadataCatalog` for the active org. The catalog:

- queries org metadata and workspace presence;
- resolves a component to either its workspace `file:` URI or an ephemeral
  `sf-org-metadata:` URI;
- fetches org-only source lazily when VS Code requests document content;
- owns caching and invalidation for workspace and default-org changes; and
- exposes query, read, refresh, and explicit download operations, but no general content
  write API or consumer registration API.

Services registers `sf-org-metadata:` with a read-only
`TextDocumentContentProvider`. It does not register a `FileSystemProvider` for org
metadata.

Each consumer owns its view:

- Org Browser maps catalog inventory and presence into its tree.
- Apex Testing continues to use the Tooling API as the authority for runnable tests,
  then uses the catalog for workspace presence and source URIs.

Catalog change events describe whether the active org or workspace changed. Consumers
re-query only when the change can affect their projection. For example, Apex Testing
rebuilds test items after a local Apex class is created or deleted because VS Code
`TestItem` URIs are immutable.

## Consequences

### Benefits

- There is one authority for org/workspace metadata facts without introducing shared
  content writers.
- Consumer APIs remain read-oriented and do not require owner registration.
- Org-only source remains ephemeral and is fetched only when opened.
- Workspace source wins naturally when a component exists both locally and in the org.
- Consumers can evolve their UI hierarchy independently.
- The URI scheme integrates with VS Code tools without pretending org metadata is a
  writable filesystem.

### Trade-offs

- `sf-org-metadata:` does not support filesystem operations such as directory reads,
  rename, delete, or write. A future feature that genuinely needs those semantics can
  introduce a VFS separately.
- Consumers must react to catalog invalidation when presence affects immutable objects
  in their view.
- Explicitly downloading metadata into the workspace remains a domain operation rather
  than a write to the ephemeral document.

## Alternatives considered

### Services-provided VFS with a registered owner

This preserves a single writer but requires registration, lifecycle coordination, and
an authority mechanism in the shared services API. It was rejected because the
registration exists to support the storage abstraction rather than a user-facing
requirement.

### Services-provided VFS with multiple writers

This avoids owner registration but exposes shared mutation to all consumers and makes
conflict resolution and coherence a services responsibility. It was rejected because
there is no reliable API-level constraint on which consumer may write which data.

### Consumer-owned VFS implementations

This keeps write ownership local but duplicates inventory, caching, invalidation, and
URI behavior across extensions. It was rejected because Org Browser and Apex Testing
need the same underlying metadata facts.

### No shared catalog

Each extension could query the org and workspace independently. It was rejected because
it duplicates expensive discovery and produces inconsistent presence and source
resolution behavior.
