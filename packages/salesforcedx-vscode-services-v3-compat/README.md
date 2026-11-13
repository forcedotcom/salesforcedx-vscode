# V3 compatibility implementation

Private, pinned Effect 3.21.2 adapter for W-24615046. Production activation binds
it to the existing V4 owner; it does not build a second services graph. See the
[bridge contract](../../docs/architecture/effect-v3-compatibility-bridge.md).

The selected V3 surface includes Connection/Alias/Config, `TargetOrgRef`,
`ApexLogService.{listLogs,getLogBody}`, and `FsService.safeWriteFile`. The log and
file operations delegate to the V4 provider through the host boundary.

The host boundary contains Promises, AbortSignals, plain SDK Connection values,
schema-encoded org/connection data, service-failure DTOs and ordered Cause reasons.
V4 Effects, Contexts, Layers and refs must never cross it. V3 classes and schemas
here are genuine V3.

The host must subscribe atomically, send the initial org snapshot before returning,
and await each org callback before acknowledging its serialized authoritative
commit. The V3 view is not an org-selection source. Production binding belongs to
W-24615059; current validation will use an already-owned V4 test runtime.

Before starting any V4 operation, the host must check an already-aborted signal;
V4 run options alone can execute synchronous work before noticing cancellation.
An org commit must remain masked from V4 mutation through completion of the V3
callback while holding its permit. A semaphore alone does not prevent an interrupted
callback's late write from overtaking a newer commit. Initialization and unsubscribe
need the same synchronization; callbacks only decode/update the V3 view.

Foreign interruption IDs use V3 `FiberId.none` or `FiberId.runtime(id, 0)`; the zero
timestamp is synthetic. Every Cause reason remains ordered, including failures from
slow finalizers. Original V3 Cause topology and caller FiberRefs/tracing metadata
are not reconstructed. The prebuilt V3 layer applies the host's shared redactor to
the existing V3 string logger; Context-only provisioning does not install a logger.

The imperative factory's `dispose` closes its V3 scope before the caller closes the
V4 runtime. Concurrent/repeated disposals share completion. Existing external V3
stream subscriptions remain owned by their consumers; the bridge owns only its host
subscription and in-flight adapter calls.
