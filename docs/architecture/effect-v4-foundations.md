# V4 foundational services

W-24615055; parent `f0a0fc563b`. This document records the V4 foundation contracts
that W-24615069 folded into the production services provider.

## Provider boundary

V4 implementations live in `salesforcedx-vscode-services/src/services` and compile
with the production provider against `effect: 4.1.4`. Canonical keys/errors remain
in `@salesforce/vscode-services/v2`; genuine V3 proxies remain in the isolated
`salesforcedx-vscode-services-v3-compat` package. The temporary V4 compiler/fixture
package was removed by W-24615069.

Keep V3 and V4 modules in their own compiler programs: the language service selects
one Effect major per program. Production activation acquires one V4 graph and shares
its memo map across filesystem bootstrap and provider layers.

W59/W60/W63 extended these stable layer values. W69 activated them in the provider,
removed superseded V3 implementations, and exposed both API versions from that owner.

## Layer ownership

- `foundationalLayers` provides Workspace, Settings, FS, Alias, Config, HostFileWatcher,
  file/settings PubSubs and the existing V4 TargetOrgRef key.
- Its `WebFileSystemProvider` requirement is a getter for the host's existing web
  provider. It never constructs another filesystem or captures a stale bootstrap value.
- `foundationalWatcherLayers` adds workspace/configuration listener acquisition.
  ChannelService remains an explicit V4 requirement; the [project/catalog graph](effect-v4-project-catalog.md)
  supplies the shared scoped host implementation.
- Each graph owns one org carrier, Config cache/subscription and each acquired watcher.
  Stable layer identity gives memoized reuse across dependent slices.
- Config retains capacity 5, TTL 30 minutes, desktop aggregator reloads, web no-reload,
  org-change invalidation and CLI/web identity preservation on clearing org state.
- PubSubs shut down with their scope. Watchers and Config's subscription use scoped
  fibers, never daemons. Readiness forwards complete registration exits, so defects
  or interruption cannot strand acquisition waiting on a Deferred.
- File listeners are acquired separately: a later registration failure releases
  already-acquired listeners and the enclosing watcher exactly once.

Connection-dependent configuration/alias watchers, auth and retrieve-on-load
settings handlers are wired into the same connection/domain closure. The V4
TerminalService uses the existing `@effect/platform` child-process boundary.

## Platform and data contracts

- Canonical V2 keys are extended, not redeclared. Host implementation stays out of
  the public contracts package; ChannelService's implementation belongs to the
  production services provider.
- The pure `uriComparison` module moved to a V2 subpath shared by the old provider
  and V4 HashableUri. It imports no Effect runtime and passes no runnable value
  across majors. Its `.cjs`/`.d.cts` artifacts support both native ESM and existing
  Node16/CommonJS consumer projects without compiler-option changes. URI
  normalization/equality retains the existing Windows/virtual rules.
- Settings retain generic falsy/default behavior, exact specialized errors and update
  targets, version fallback, tolerant session decoding and redacted access tokens.
- Config spans use the existing allowlist; resolved credentials are never spread
  onto a span.
- SDK host watching uses `@salesforce/core/fs` on desktop and web. The callback API's
  `close()` works for both backends; SDK memfs does not emit Node's `close` event.
  `HostFileSystem` reads the SDK's current backend when acquiring a watch, including
  a backend replaced after layer acquisition.
- SDK `VirtualFs` erases incompatible watch overloads to `any`. One documented,
  type-only adapter restores the supported Node/memfs callback signature; real-backend
  tests cover events and release. No Node filesystem runtime is imported there.
- VS Code typings are a compatible `^1.90.0` peer, not a pinned nested dependency.
  The strict mixed packed consumer exposed ambient-type conflicts with legacy's
  newer declarations; a shared peer resolves them without `skipLibCheck` changes.

## Verification boundary

Focused tests exercise actual V4 layers with only SDK/VS Code edges substituted:
cache sharing/capacity/invalidation, fresh workspace reads, settings/aliases/errors,
redaction, scoped singletons, event delivery, failed registration, partial rollback,
startup cancellation, real Node/memfs watches and late backend replacement.

`scripts/test-foundational-services.mjs` packs the production services package and
contracts, installs them outside the checkout and checks strict declarations, real V4 LS
positive/negative controls, and missing-provider/channel TypeScript failures.
Node and browser-target bundles execute the actual graph; the latter uses jsdom
under Node for the SDK's browser globals. This is not a browser or VS Code E2E run.
GitHub desktop/web E2E remains the delivery gate.
