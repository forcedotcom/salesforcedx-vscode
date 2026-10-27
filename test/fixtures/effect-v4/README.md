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

This caught two real failures: an unpublished sibling declaration import (`TS2307`) and incompatible V3 declaration identities caused by ranged Effect/platform versions. Legacy declarations are now bundled and validated; the legacy Effect ecosystem versions stay pinned independently of the future V4 implementation. No `--no-check` or other gate bypass.

When the packed public artifact changes, regenerate its consumer lock intentionally with `node scripts/test-packed-services.mjs --update-lock`; this still installs and typechecks the package. Normal CI uses `npm ci`, never updates the lock. This does not claim support for untested V3 minors.

**Open Spec P1:** an equivalent packed installation/typecheck for the actual V2 public package is still required. W-24615044 remains incomplete until both public declaration protocols are covered.

## Existing diagnostic rule compatibility

Reviewed against the pinned LS source in the migration plan. No existing rule removed. TypeScript negative projects cover V4 missing service/layer requirements independently of V3 service-constructor diagnostics.

| Applies to | Existing enforced rules |
| --- | --- |
| V3 only | `missingEffectServiceDependency`, `schemaUnionOfLiterals` |
| V3 and V4 | `lazyPromiseInEffectSync`, `runEffectInsideEffect`, `globalErrorInEffectFailure`, `globalErrorInEffectCatch`, `catchUnfailableEffect`, `tryCatchInEffectGen`, `unknownInEffectCatch`, `effectSucceedWithVoid`, `unnecessaryFailYieldableError`, `effectFnIife`, `unnecessaryEffectGen`, `unnecessaryPipeChain`, `returnEffectInGen`, `floatingEffect`, `globalRandom`, `globalRandomInEffect`, `globalFetchInEffect`, `globalTimersInEffect`, `missedPipeableOpportunity`, `instanceOfSchema`, `extendsNativeError`, `globalFetch`, `anyUnknownInErrorContext`, `globalConsoleInEffect`, `nestedEffectGenYield`, `strictEffectProvide` |
