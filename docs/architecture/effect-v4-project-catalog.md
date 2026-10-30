# Effect V4 project and catalog services

W-24615060 extends the isolated V4 graph from W-24615059. Production activation remains V3 until W-24615069; this is not a partial V4 release.

## Dependency closure

This slice owns Project, Registry, SourceTracking, catalog state/stores, workspace and hierarchy projections, remote source/shadow materialization, and the text document provider. Documents are not deferred.

Real reader prerequisites move forward from W-24615063: describe/cache/invalidation, query, ComponentSet construction/properties, nonmerge retrieve-to-directory, Transmogrifier/models, Channel, metadata notifications, and active-operation state. W-24615063 retains merged workspace retrieve, deploy, delete, and remaining operation services.

Canonical V4 keys, schemas, errors, and domain data live in `@salesforce/vscode-services-v2`. Implementations remain temporarily in `@salesforce/vscode-services-v4-implementation`; W-24615069 folds them into the provider and removes superseded V3 implementations. No runnable V3 services enter the V4 graph.

## One graph and public Context

Stable layer values compose foundations → connection → Project/Registry/ComponentSet → stores/state/recorder → readers → inventory/documents/catalog → provider. Layer memoization shares the same caches, org writer, notifications, and watchers.

`createCatalogRuntime` delegates once to the existing connection owner. W60 established 23 canonical public keys; [W63 metadata operations](effect-v4-metadata-operations.md) extends the explicit whitelist to 26. Private state, org coordination, host messages, and implementation tags are excluded at runtime, not hidden by a cast. The prebuilt Layer reuses those instances and the redacting logger. The unchanged Promise/AbortSignal/data host still returns the same native SDK Connection to genuine V3 adapters.

Pure URI comparison/containment remains in the existing CJS `uriComparison` subpath. V3 callers can reuse it without loading V4 schemas or runnable values. SDK Project cache keys retain native path normalization at their filesystem boundary.

## Org and hierarchy publication

`OrgChanges.generation` arbitrates auth attempts. `orgGeneration` identifies the committed org/user lifetime: same-org reads and username-case canonicalization do not advance it; accepted clears do, including an already-empty clear. A→B→A cannot revive an old operation.

Readers capture one epoch and validate before returning or publishing. `commitIfCurrent` masks validation plus bounded publication under the existing org semaphore. No network/polling or reentrant org coordination belongs inside that commit.

Catalog invalidation has an additional synchronization requirement: an invalidator's snapshot of existing type semaphores can omit a newly admitted type. Every hierarchy invalidator, generation/cache snapshot, and bounded inventory/workspace-type/projection publication therefore shares the state-owned hierarchy commit permit.

Lock order: type inventory permit(s) → hierarchy commit permit → org permit → bounded state mutation/hydration coordination. SDK discovery and network calls run outside hierarchy/org permits. Raw state getters/setters do not reacquire the hierarchy permit. Generation comparison and installation must remain atomic even when Effect's scheduler yields automatically.

Cache-only hierarchy reads use `loadCachedType`, which cannot call remote discovery. It may restore a complete persisted observation and scan local workspace files under the existing type permit. Replacing a persisted partial inventory with a complete discovery queues persistence even if other observations already flushed.

## SourceTracking and the SDK boundary

Keep source-tracking **8.1.7** and its behavior unchanged. Own and await its public promises; do not turn fixing SDK internals into a migration prerequisite.

Each tracking-instance operation holds a lease before acquiring local/remote permits. Combined operations consistently acquire local then remote. Replacing the native Connection, Project, or committed epoch stops old-instance admission and drains its public operations without holding domain/org permits. Cancellation/disposal retains leases and permits until public-promise settlement.

SDK local and remote singleton ownership is observed immediately at public SDK invocation, not at lazy `SourceTracking.create`. Cleanup removes only the exact acquired cache value if it is still installed. It never deletes durable tracking files or evicts another owner's replacement.

The SDK can retain hidden fail-fast siblings or abandoned timed-out poll attempts after its public promise settles. Its cache keys also have upstream limitations. Those are documented SDK constraints, not guarantees fixed by this migration. Disposal does **not** promise all hidden SDK descendants have stopped.

Tracking observation order is refresh/status/revisions → prepare → epoch-guarded describe invalidation → recorder commit/event. Invalidation precedes consuming the signature; failure remains retryable. Revision-only changes produce an event; identical observations do not.

## Documents and filesystem ownership

Nonmerge retrieve uses the real SDK start/poll/ZIP extraction and leaves workspace source unchanged. Owning cleanup settles native retrieval before deleting staging. Shadow materialization copies bytes, including binary StaticResources, rather than decoding/re-encoding source as UTF-8. Native directory conversion may add a `metadataPackage_*` child or change a resource suffix; select actual SDK output.

Apex document bodies use the actual query reader, preserve protected-source text, publish revisioned shadows, and reuse matching revisions. Documents validate the captured org again after file I/O.

The provider registers one `TextDocumentContentProvider`, never an org metadata filesystem. Its native V4 callback Context preserves owner overrides/Clock/logging. Registration, subscriptions, workers, requested URIs, and emitter belong to the graph's scope. Org changes close inactive text/diff tabs without closing ordinary workspace tabs.

Workspace changes under `.sf` do not invalidate their producing catalog. Other changes invalidate workspace projections before notifying requested org documents. Events during metadata operations wait for completion and are deduplicated against operation file paths. The delayed zero-active handler rechecks/drains atomically under the existing active ref permit without publishing another zero.

## Verification

- `pnpm --filter @salesforce/vscode-services-v4-implementation test`: normal task, including test compilation, packed fixtures and unit tests.
- Both packages' normal lint and 28-rule `check:effect-diagnostics` tasks.
- `scripts/test-foundational-services.mjs`: strict packed declarations/LS controls; actual packed Node and browser-target Project discovery, native ZIP/binary shadow materialization, registered document notifications, public-only Context, native Connection identity, and teardown.
- Frozen V3/V4/mixed declarations and independently installed genuine V3 adapter fixtures, including real connection graphs.
- Normal repository gates/hooks, inventory, fresh-parent duplication comparison, Standards/Spec/Effect reviews, then exact-head GitHub desktop/web E2E before W-24615063.

Browser-target fixture execution under Node/jsdom is not VS Code E2E. Results and pending gates are delivery receipts, not permanent architectural facts. No SDK patches, consumer dependency changes, local VS Code E2E, or GUS status/link writes are part of this slice.
