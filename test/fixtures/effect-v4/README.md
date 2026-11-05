# Effect V3/V4 compatibility gates

Run `pnpm test:effect-v4-compat` from repository root. Also runs in root `test` / pre-push / CI.

- Provider and consumer each install their own locked **3.21.2** (`npm ci`), matching inspected Einstein `main` `eb3355df087303eeebca510e91d480ae884b6d57`. No shared/symlinked node_modules; checks physical resolution.
- V4 host independently installs `effect`, `@effect/platform-node`, `@effect/opentelemetry` **4.0.6**; verifies each resolves the same major/version. Does not change first-party production resolution yet.
- Frozen V3 accessor/Context/Layer/ref/alias/config protocol compiles and runs across installations. These are contract fixtures, not claims that live V4 adapters or real Salesforce auth are implemented; W-24615046 replaces fixture provisioning with adapter integration.
- V4 positive `Context.Service`/Layer program typechecks and bundles for Node and browser. V3 bundles retain both independent installations and exclude V4. Bundles execute under Node; real browser/desktop E2E runs in GitHub CI.
- V4 negative inputs must report `floatingEffect`, `anyUnknownInErrorContext` and `runEffectInsideEffect`; repository diagnostic wrapper must exit 1. Intentional negative files are not application source.
- Missing V4 layer/service dependencies fail a separate negative TypeScript project. Raw V4 Layers fail in an isolated V3 child process.
- Same `@effect/language-service` as editor and existing package gates; inherited plugin configuration. No separate V4-only LS, no disabled V3 checks. `typescript.enablePromptUseWorkspaceTsdk` keeps the configured workspace TypeScript visible in VS Code.

Workspace version validation requires exact reviewed Effect versions and copies. `config/effect-version-boundaries.json` records ordinary dependencies and the public package's V3 alias separately. Companion peers must resolve their owner's Effect copy. Independent fixture installations are verified by their own gates. Manifest, lockfile and boundary-config changes invalidate the consistency test's Wireit cache.

IAC/core compile fixture exercises the actual core exports' Channel/Workspace/CommandEventDispatcher/getOrgShape/telemetry calls, not substitute class declarations. Runtime IAC behavior still needs its integrated tests. Do not treat the protocol fixture as complete external API coverage.

## Actual packed legacy declarations

`pnpm test:packed-services` builds and packs the real `@salesforce/vscode-services` package into independent V3-root, V4-`/v2`, and mixed consumers outside the checkout. Each owns a normal locked install. The package installs ordinary V4 and aliased V3; root imports must not load V4. V3 **3.21.2** consumers typecheck actual accessor/Context/ref calls with `strict:true`, `skipLibCheck:false`. No node_modules directory is reused.

The unversioned declaration exposes only the audited Connection/Alias/Config operations, target-org ref and prebuilt Context/Layer. Controls reject internal schema/error exports, unused service members and runtime use of the API type. The runtime root exports only `ICONS`.

This caught two real failures: an unpublished sibling declaration import (`TS2307`) and incompatible V3 declaration identities caused by ranged Effect/platform versions. Legacy declarations are now bundled and validated; the legacy Effect ecosystem versions stay pinned independently of the future V4 implementation. No `--no-check` or other gate bypass.

When the packed public artifact changes, regenerate its consumer lock intentionally with `node scripts/test-packed-services.mjs --update-lock`; this still installs and typechecks the package. Normal CI uses `npm ci`, never updates the lock. This does not claim support for untested V3 minors.

## Actual packed V2 declarations

The same public package exposes `/v2` with its real V4 service keys, schemas and
errors. A consumer using ordinary V4 typechecks
Connection/Alias/Config/org-ref calls and Context/Layer provisioning. Node/browser
bundles execute those actual keys with injected test implementations. This verifies
the initial public contract, not production V4 activation or Salesforce auth.

A third independent installation imports both endpoints from that same package and rejects
cross-major Effect, Context, Layer and SubscriptionRef usage. All three consumers
use `strict:true`, `skipLibCheck:false`, separate node_modules and committed registry
locks. Regenerate only a selected lock with `--update-lock=packedV2` or
`--update-lock=packedMixed`; regeneration still installs and typechecks.

Lock regeneration starts from the existing registry lock, retaining unrelated
versions/hashes while npm updates dependencies required by a changed public
manifest. Normal CI still rejects manifest/lock dependency drift before `npm ci`.

The private compatibility package generates a selected declaration bundle from the
provenance-recorded full V3 snapshot in its V3 scope. The public build rewrites only
Effect module specifiers to `effect-v3`, then strictly checks the final artifact.
The published subset contains no private-package or V3 companion-library imports.
Full internal V3 ABI probes use the existing private compatibility package. V4 keys
remain canonical; neither public endpoint constructs a live graph.

Two physical Effect 4.0.6 copies fail when one decodes the other's schema. V2
query/JSON APIs therefore accept caller-owned decoder functions, not Schema objects.
Query's callback decodes the whole page so nested issue paths and transforms stay
inside the caller's schema graph. Caller errors and requirements are preserved;
JSON wraps only typed decoder failures in its existing filesystem error contract.

The foundation gate also installs `decoderConsumer` independently and verifies
different physical paths and live Schema modules. Consumer/provider Node and
browser-target bundles are built separately. The real Fs/Query graph exercises
branded/transformed values, required services, typed errors, defects, full-page
schema paths, acquisition timing, lazy replay, tracing and interruption finalizers.
Raw foreign-schema decoding remains a failing negative control. Browser bundles
execute under Node/jsdom, not VS Code E2E; the harness restores browser-installed
globals and retains Node's real process for nonzero failure status.

## Existing diagnostic rule compatibility

Reviewed against the pinned LS source in the migration plan. No existing rule removed. TypeScript negative projects cover V4 missing service/layer requirements independently of V3 service-constructor diagnostics.

| Applies to | Existing enforced rules |
| --- | --- |
| V3 only | `missingEffectServiceDependency`, `schemaUnionOfLiterals` |
| V3 and V4 | `lazyPromiseInEffectSync`, `runEffectInsideEffect`, `globalErrorInEffectFailure`, `globalErrorInEffectCatch`, `catchUnfailableEffect`, `tryCatchInEffectGen`, `unknownInEffectCatch`, `effectSucceedWithVoid`, `unnecessaryFailYieldableError`, `effectFnIife`, `unnecessaryEffectGen`, `unnecessaryPipeChain`, `returnEffectInGen`, `floatingEffect`, `globalRandom`, `globalRandomInEffect`, `globalFetchInEffect`, `globalTimersInEffect`, `missedPipeableOpportunity`, `instanceOfSchema`, `extendsNativeError`, `globalFetch`, `anyUnknownInErrorContext`, `globalConsoleInEffect`, `nestedEffectGenYield`, `strictEffectProvide` |
