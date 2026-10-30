# V3 services compatibility bridge

W-24615046 implementation contract. [Migration plan](effect-v4-migration.md).
Production connection/org binding remains W-24615059; no second service graph.

## Runtime boundary

`@salesforce/vscode-services-v3-compat` is private and owns Effect **3.21.2**.
`createLegacyServices(host, signal?)` returns genuine V3 service keys/accessors,
Context, prebuilt Layer and a stable V3 SubscriptionRef. Its imperative `dispose`
is the cross-major ownership boundary, not an exported extension command.

The injected host enters an already-owned V4 runtime. Arguments/results contain
Promises, AbortSignals, SDK Connection objects and schema-encoded data—not foreign
runnable Effects, Contexts, Layers or refs. Error/org DTOs derive from V3 schemas'
`Encoded` types, removing protocol-specific brands without casts. SDK Connection
identity is retained. Typed errors are decoded into genuine V3 tagged errors;
schema fields are preserved, not foreign error prototypes or tracing metadata.

Every V4 Cause reason becomes a fresh plain record in existing order. The V3 side
folds all records into a sequential Cause; original topology is unavailable.
Malformed failure data becomes a defect without discarding later reasons. Defect
payloads remain opaque and retain identity. Foreign interrupt IDs use V3
`FiberId.none` or `FiberId.runtime(id, 0)`; the timestamp is synthetic.

## Cancellation and ownership

- Check an already-aborted signal before starting work. V4 run options alone can
  execute synchronous effects before noticing cancellation. Creation guards this
  too, before beginning host initialization.
- V3 cancellation aborts the host operation, then waits under a mask for its
  completion/finalizers and retains all returned Cause reasons. An async cleanup
  callback's `never` error channel must not drop typed failures.
- Admission and registration are atomic. Shutdown closes admission, aborts every
  active call before waiting for any, drains adapter completions, then unsubscribes.
  Concurrent/repeated disposals share completion, including finalizer defects.
- Subscription acquisition stays masked through stop-handle registration. A late
  successful acquisition during startup cancellation is still released.
- Dispose the V3 bridge **before** its owning V4 runtime. External V3 stream scopes
  remain consumer-owned; the bridge owns only its host subscription and calls.

## Org consistency

The host atomically registers and supplies the initial snapshot before returning.
Hold the org-commit permit and mask V4 mutation through completion of every V3
callback. A semaphore alone is insufficient: interruption can release its permit
while a native Promise callback continues, later overwriting a newer V3 snapshot.
Registration, rollback and unsubscribe use the same serialization. Callbacks only
decode/update the V3 view; they must not reenter host operations.

After a completed authoritative commit, immediate V3/V4 reads agree. Rapid commits
remain ordered for multiple subscribers. Direct external V3 ref mutations remain
local and the next authoritative commit replaces them, including an equal V4 value.

## Logging and overrides

The prebuilt V3 Layer installs the existing V3 string logger through the host's
shared synchronous redactor. Context-only provisioning installs no logger, as
before. Neither path implicitly installs an OTEL tracer. Caller FiberRefs, spans,
schedulers and dependency overrides are not transferred into V4. Replacing an
exported V3 service in the caller's V3 Context still works.

## Verification

`pnpm test:effect-v3-bridge` packs the real implementation and public V2 keys,
installs separate V3 consumer/V4 host trees, and typechecks with `skipLibCheck:false`.
It exercises a real offline SDK Connection, one V4 graph, errors/Causes, scopes,
org acknowledgments, mutation policy, overrides and redaction. A deliberately
interruptible test-host control reproduces the stale-write bug prevented by masking.
Node/browser-target bundles retain the expected physical runtimes; browser-target
unit bundles execute under Node. Actual desktop/web E2E comes from GitHub.

Packed installations use `RUNNER_TEMP` when supplied, otherwise OS temp, and reject
storage inside the checkout. On hosted Windows, OS temp is on the system volume;
runner temp is working storage ([runner I/O issue](https://github.com/actions/runner-images/issues/8755)).
Each fixture still owns fresh node_modules. Windows uses Node's bundled npm CLI
when that file exists, avoiding a shell wrapper; install timings are logged.
No audit, dependency, typecheck, timeout or job-budget checks are disabled.
