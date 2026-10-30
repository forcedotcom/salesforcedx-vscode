# Effect V4 metadata operations

W-24615063 completes merged retrieve, deploy, destructive marking/local deletion and Lightning bundle rename on W60's existing V4 graph. Describe/query, ComponentSet, Transmogrifier and nonmerge retrieve remain the real W60 implementations. Production activation stays V3 until W-24615069; no second production graph or sf-effect-sdk adoption.

## One owner and captured org

The stable graph composes SourceTracking below retrieve/deploy and publishes the same instances through the explicit 26-key `publicServiceKeys` whitelist. `createCatalogRuntime` still delegates once to the existing owner. Private operation-org, tracking-result, notification and localization keys never enter the customer Context. Genuine V3 adapters keep their original contracts and native Connection identity.

`MetadataOperationOrg` reads the existing ConnectionService/OrgChanges owner. It owns no ref, cache or writer. Each operation captures its native Connection, orgId, committed orgGeneration and known tracking capability before network work. An operation does not recapture the default org when applying its result. Same-org credential refresh may replace the cached Connection without changing the committed epoch; A→B→A advances that epoch.

One SourceTracking layer construction emits both the public service and private `SourceTrackingResultUpdates`. They share the same SDK entry, leases, local/remote permits and cleanup. Private result application uses the enclosing operation's captured identity; public method signatures remain unchanged.

## Native promises and cancellation

`performNativeMetadataOperation` owns SDK start, polling/extraction, cancellation, the progress listener and result consumption in one bracket. Cancellation is registered before awaiting `ComponentSet.deploy()`, which starts deployment before returning its operation. A request is replayed only after the SDK operation has its ID. Every started public promise settles before dependencies are released.

Native result and cancellation failure remain separate until the domain policy consumes them:

- Retrieve retains its cancellation policy: successful native completion after a UI cancellation request reports UserCancellationError; native/cancellation failures retain their actual public SDK error values.
- Deploy honors the server outcome. Canceled/Canceling reports UserCancellationError. Succeeded/SucceededPartial applies tracking and publication even if UI cancellation raced with success or cancel() rejected; cancellation failure propagates afterward, combined with any application failure.
- Caller interruption and owner disposal cancel/drain native work. If interruption wins before Effect consumes an already-settled failure, bracket cleanup still propagates that failure. Listener disposal is independent of the server's result status.

SDK public errors may already wrap transport errors, such as SDR's MetadataTransferError. Preserve the public promise's actual rejection identity rather than inventing a different transport-level guarantee.

Source-tracking 8.1.7 and SDK behavior remain unchanged. Stale identity before SDK entry prevents entry. An epoch change during an already-entered tracking or merge promise cannot undo its filesystem writes: drain the captured entry's public promise, then reject further application, publication and result delivery. Do not promise rollback or completion of hidden SDK work.

## Cache and notification order

Active-operation count covers the complete pipeline, including tracking and publication:

1. Settle native work and apply SourceTracking using the original identity.
2. For merged retrieve, invalidate workspace membership through the existing state owner's guarded workspace invalidator. This includes the cached root metadata-type scan; correlated filesystem events may be deduplicated later.
3. Perform epoch-aware describe invalidation.
4. Call recorder.recordOperation(event, capturedGeneration).
5. Publish the public metadata notification under the existing org guard.
6. Validate before result delivery, then release the active-operation count.

Describe invalidation and recorder calls own their locks and org commits. Never wrap them in another org commit. State invalidation preserves inventory permits → hierarchy permit → org permit → bounded mutation/hydration ordering. No SDK/network work belongs under hierarchy/org commits.

Notifications preserve native component states and deduplicate source/descriptor paths. All-deleted deploy responses produce a delete operation. An immediate subscriber sees invalidated describe/catalog caches and fresh workspace type membership, including a first local type created by retrieve.

## Local mutations and host messages

Destructive marking preserves ComponentSet project/API properties and marks post-deploy destructive changes. Native CustomLabel deletion preserves other labels in their shared XML. Safe deletion retains existing behavior. Lightning rename retains strict top-level bundle patterns and fuzzy test-file matching, then renames the directory.

Each started filesystem mutation drains individually before cancellation releases dependencies. The entire multi-file rename is not uninterruptible: cancellation can stop subsequent mutations. `MetadataOperationMessages` receives provider-owned localized deploy/delete titles without importing the still-V3 provider implementation.

## Verification boundaries

- Native SDK transport tests exercise successful/partial/failed/canceled deployment, cancellation races/failures, merged extraction, actual STL conflicts, captured-epoch rejection and delayed settlement.
- SourceTracking controls distinguish stale-before-entry from epoch changes during an already-entered native promise; they assert draining, not rollback.
- Filesystem tests cover CustomLabel XML, destructive sets, bundle matching and individual mutation draining.
- Independently installed packed Node/browser graphs exercise merged binary retrieve, native ZIP deploy/destructive deploy, local deletion, bundle rename, query consumption, shared Connection identity, explicit public Context, one provider/channel and teardown.
- Normal gates/hooks, separate Standards/Spec/Effect reviews, fresh-parent duplicate comparison and native stack registration precede exact-head GitHub desktop/web E2E acceptance.

Browser-target fixture execution under Node/jsdom is integration evidence, not VS Code E2E. This slice does not authorize GUS status/link writes or merging the stack.
