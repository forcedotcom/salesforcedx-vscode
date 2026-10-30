# V4 connection migration

W-24615059 extends the temporary private V4 implementation package. Production activation remains V3 until W-24615069; this slice verifies the actual connection graph independently, not a second activated provider graph.

## Ownership

- Canonical V2 `ConnectionService`, Config, Alias, Settings and `TargetOrgRef` keys; reuse W55's stable foundational layers.
- Connection layer owns desktop/web connection, reauth, user-identity and dev-hub caches. No module-global cache or secondary SDK Connection wrapper.
- Shared `ServiceOperations` admission tracks bounded service-operation child fibers, including V2 calls made by consumer-owned runtimes. Shutdown drains service work, never unrelated caller finalizers that might themselves await provider disposal.
- Auth saves and enrichment run in the Connection layer's scope. SDK `AuthInfo.save()` cannot abort: an already-started save completes before scope disposal returns.
- `ConnectionHost` supplies the services extension's global state and localized connection messages. W69 supplies those existing host values during activation; no V3 runtime is a dependency.
- Connection graph adds scoped alias/global-config watches and project-config/web-auth subscriptions; reuse existing filesystem/settings publishers. Web auth-setting changes retain the prior identity when settings are temporarily incomplete.
- One failure recorder per sequential owning scope (Layer default) retains failed child exits. Native `forkIn` atomically registers/removes each child; completed successes retain no extra finalizer. Pure shutdown interruption is ignored; mixed failure reasons retain their order, payload identity and annotations.

## Default-org commits

`OrgChanges` is the private writer for the canonical V4 ref. Its generation identifies a default-org selection attempt, reserved **before** config/auth awaits. Explicit-username calls do not select an org.

- New selections and clears invalidate older work, including A→B→A and same-org/different-user races.
- Quick identity publishes coherent org/username state. Changing identity drops old org-specific enrichment, preserving CLI/web telemetry IDs.
- Enrichment and alias refreshes commit only against their captured generation. Alias refresh also validates captured username/org identity inside the commit: a reserved generation may still contain the previous org's identity. Alias revisions prevent slow enrichment from replacing fresher aliases.
- Config unset reserves its generation before asynchronous writes. Clears preserve CLI/web telemetry IDs and reject stale unset/failure continuations.
- One semaphore serializes registration/snapshot, mutation/acknowledgment and unsubscription. Permit acquisition is interruptible; committed mutation plus all V3 acknowledgments are masked.
- Equal canonical commits still acknowledge V3, repairing external local-only ref writes without duplicate V4 publications.
- Config/auth/query work stays outside the commit permit. The bounded telemetry global-state write is inside it, so stale enrichment cannot persist another org's identity.

## Cross-major boundary

`compatibilityHost.ts` contains only SDK Connection, plain encoded org/error/Cause shapes, Promise and AbortSignal. It imports neither major's schemas, Effects, Layers, Contexts or refs. Independent fixtures check both codecs.

The V4 owner acquires one caller-supplied graph and derives V2's prebuilt Context/Layer from its actual instances. The genuine V3 adapter delegates through Promise/AbortSignal and maintains its own V3 SubscriptionRef. Its acknowledgment runner masks decode/write explicitly; runtime interruption masks do not transfer between majors.

The owning V4 graph and V2 prebuilt Layer replace default loggers with a shared formatter/redactor/console policy, including causes and annotations. Context-only provisioning remains context-only. Full telemetry-aware logging/observability is assigned to W69; do not reintroduce an unredacted default or tracer logger alongside this policy.

The V3-only `createCompatibleConnectionServices` initializes the bridge before returning either API. Shutdown closes admission, drains operations, stops the V3 adapter, then disposes V4, including failure paths. Repeated disposals share the whole cached outcome, not merely a cached "already disposed" flag. Ordered Cause reasons and opaque defect identities cross; Cause topology, FiberRefs and tracing context do not.

## Deferred

- W60/W63 add project/catalog and full operation/query services. The raw V4 query executor here is Connection's required identity-query dependency, not QueryService activation.
- W69 folds the private implementations into the provider, supplies host/observability services, replaces production activation, and removes superseded V3 implementations and temporary package wiring.
- W75 migrates shared first-party consumer plumbing; final-cutover work verifies packaged auth/org-switch acceptance and external shipping refs.
- No sf-effect-sdk adoption, legacy declaration repointing, core Connection substitution or public `api.v1` alias.
