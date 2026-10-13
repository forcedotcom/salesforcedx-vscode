# Keep Effect.Service at real org catalog seams

The org catalog does not need an `Effect.Service` for every private module. Retain it where a public interface, shared lifetime, persistence, publication, or cross-subsystem substitution makes the seam real; otherwise a service adds an interface without owning a distinct responsibility.

Retain `Effect.Service` for `OrgMetadataCatalog` (public interface), `OrgCatalogState` (shared state and lifetime), `OrgMetadataCatalogChangePubSub` (shared publication and lifetime), `OrgMetadataCatalogRecorder` (the write seam for metadata-producing services), `OrgMetadataCatalogStore` (checkpoint persistence), and `OrgMetadataShadowStore` (revision persistence). Retain `OrgCatalogRemoteSource` while it owns serialization; reassess that seam if serialization moves elsewhere.

Private canonical modules without an owned lifetime may instead expose standalone `Effect.fn` operations or constructor effects. This changes internal module shape, not the public catalog contract: preserve ADR 0021's `getChildren`, `getEntries`, and `resolveComponents` interface and the generated service types. Do not replace them with a manually maintained public interface.

See [ADR 0021](../../../../docs/adr/0021-org-metadata-catalog.md) for the public catalog decision.
