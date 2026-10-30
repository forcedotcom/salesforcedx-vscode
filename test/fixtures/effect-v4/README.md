# Effect V3/V4 compatibility gates

Run `pnpm test:effect-v4-compat` from repository root. Also runs in root `test` / pre-push / CI.

- Provider and consumer each install their own locked **3.21.2** (`npm ci`), matching inspected Einstein `main` `eb3355df087303eeebca510e91d480ae884b6d57`. No shared/symlinked node_modules; checks physical resolution.
- V4 host independently installs `effect`, `@effect/platform-node`, `@effect/opentelemetry` **4.0.6**; verifies each resolves the same major/version. Does not change first-party production resolution yet.
- Frozen V3 accessor/Context/Layer/ref/alias/config protocol compiles and runs across installations. These are contract fixtures, not claims that live V4 adapters or real Salesforce auth are implemented; W-24615046 replaces fixture provisioning with adapter integration.
- V4 positive `Context.Service`/Layer program typechecks and bundles for Node and browser. V3 bundles retain both independent installations and exclude V4. Bundles execute under Node; real browser/desktop E2E runs in GitHub CI.
- V4 negative inputs must report `floatingEffect`, `anyUnknownInErrorContext` and `runEffectInsideEffect`; repository diagnostic wrapper must exit 1. Intentional negative files are not application source.
- Missing V4 layer/service dependencies fail a separate negative TypeScript project. Raw V4 Layers fail in an isolated V3 child process.
- Same `@effect/language-service` as editor and existing package gates; inherited plugin configuration. No separate V4-only LS, no disabled V3 checks. `typescript.enablePromptUseWorkspaceTsdk` keeps the configured workspace TypeScript visible in VS Code.

Workspace version validation still requires one shared first-party Effect spec and resolved copy. `config/effect-version-boundaries.json` names exact reviewed exceptions (currently only the legacy declaration package). Each companion must satisfy its peer range and resolve its owner's Effect copy. Independently installed fixture trees are tested by their own gates, not mistaken for workspace runtime consumers by a filesystem-wide glob. Manifest, lockfile and boundary-config changes invalidate the consistency test's Wireit cache.

IAC/core compile fixture exercises the actual core exports' Channel/Workspace/CommandEventDispatcher/getOrgShape/telemetry calls, not substitute class declarations. Runtime IAC behavior still needs its integrated tests. Do not treat the protocol fixture as complete external API coverage.

## Actual packed legacy declarations

`pnpm test:packed-services` builds and packs the real `@salesforce/vscode-services` package, copies only fixture source/manifests into a fresh directory outside this checkout, installs its locked dependencies, asserts no Effect V4 is required, and typechecks real static accessor/Context/ref calls with V3 **3.21.2**, `strict:true`, `skipLibCheck:false`. No checkout's node_modules is reused.

The public declaration entry preserves the generated source's type-only exports over an internal bundled declaration module. Packed controls reject runtime use of `GetAuthFieldsError` / `DefaultOrgInfoSchema`, and verify that the runtime root exports only `ICONS`.

This caught two real failures: an unpublished sibling declaration import (`TS2307`) and incompatible V3 declaration identities caused by ranged Effect/platform versions. Legacy declarations are now bundled and validated; the legacy Effect ecosystem versions stay pinned independently of the future V4 implementation. No `--no-check` or other gate bypass.

When the packed public artifact changes, regenerate its consumer lock intentionally with `node scripts/test-packed-services.mjs --update-lock`; this still installs and typechecks the package. Normal CI uses `npm ci`, never updates the lock. This does not claim support for untested V3 minors.

## Actual packed V2 declarations

The same gate packs `@salesforce/vscode-services-v2` from its real package-owned V4
service keys, schemas and errors. An independent V4-only installation typechecks
Connection/Alias/Config/org-ref calls and Context/Layer provisioning. Node/browser
bundles execute those actual keys with injected test implementations. This verifies
the initial public contract, not production V4 activation or Salesforce auth.

A third independent installation contains both actual public packages and rejects
cross-major Effect, Context, Layer and SubscriptionRef usage. All three consumers
use `strict:true`, `skipLibCheck:false`, separate node_modules and committed registry
locks. Regenerate only a selected lock with `--update-lock=packedV2` or
`--update-lock=packedMixed`; regeneration still installs and typechecks.

Lock regeneration starts from the existing registry lock, retaining unrelated
versions/hashes while npm updates dependencies required by a changed public
manifest. Normal CI still rejects manifest/lock dependency drift before `npm ci`.

The legacy build now consumes a provenance-recorded V3 declaration snapshot rather
than the provider's changing implementation. It synchronizes only release versions,
not provider dependencies. V2's package-owned keys become the implementation's keys
in later WIs; no live service graph is created by this package.

## Existing diagnostic rule compatibility

Reviewed against the pinned LS source in the migration plan. No existing rule removed. TypeScript negative projects cover V4 missing service/layer requirements independently of V3 service-constructor diagnostics.

| Applies to | Existing enforced rules |
| --- | --- |
| V3 only | `missingEffectServiceDependency`, `schemaUnionOfLiterals` |
| V3 and V4 | `lazyPromiseInEffectSync`, `runEffectInsideEffect`, `globalErrorInEffectFailure`, `globalErrorInEffectCatch`, `catchUnfailableEffect`, `tryCatchInEffectGen`, `unknownInEffectCatch`, `effectSucceedWithVoid`, `unnecessaryFailYieldableError`, `effectFnIife`, `unnecessaryEffectGen`, `unnecessaryPipeChain`, `returnEffectInGen`, `floatingEffect`, `globalRandom`, `globalRandomInEffect`, `globalFetchInEffect`, `globalTimersInEffect`, `missedPipeableOpportunity`, `instanceOfSchema`, `extendsNativeError`, `globalFetch`, `anyUnknownInErrorContext`, `globalConsoleInEffect`, `nestedEffectGenYield`, `strictEffectProvide` |
