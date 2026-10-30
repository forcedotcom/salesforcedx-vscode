# Effect V4 migration

Spec: W-24615037, epic [VS Code Effect V4 migration with V3 consumer compatibility](https://gus.lightning.force.com/lightning/r/ADM_Epic__c/a3QEE000002mNkL2AU/view). Decision: [ADR 0023](../adr/0023-effect-v4-with-v3-compatibility.md). This document defines implementation gates, not a claim that the migration is complete.

## Reviewed revisions

Inspected 2026-10-26; refresh before cutover. Consumer revisions identify inspected code, not dependencies to modify.

- Repository base: `4fb333a8cb7269318b9a344a0215cb471286d8d0`.
- Effect migration source: [`d5a3dc3eacffc3dad4daeb30ffd9e56523da9632`](https://github.com/Effect-TS/effect/tree/d5a3dc3eacffc3dad4daeb30ffd9e56523da9632). Reviewed [index](https://github.com/Effect-TS/effect/blob/d5a3dc3eacffc3dad4daeb30ffd9e56523da9632/MIGRATION.md), [services](https://github.com/Effect-TS/effect/blob/d5a3dc3eacffc3dad4daeb30ffd9e56523da9632/migration/services.md), [runtime](https://github.com/Effect-TS/effect/blob/d5a3dc3eacffc3dad4daeb30ffd9e56523da9632/migration/runtime.md), [Cause](https://github.com/Effect-TS/effect/blob/d5a3dc3eacffc3dad4daeb30ffd9e56523da9632/migration/cause.md), [Scope](https://github.com/Effect-TS/effect/blob/d5a3dc3eacffc3dad4daeb30ffd9e56523da9632/migration/scope.md), [Schema](https://github.com/Effect-TS/effect/blob/d5a3dc3eacffc3dad4daeb30ffd9e56523da9632/migration/schema.md) and [Layer memoization](https://github.com/Effect-TS/effect/blob/d5a3dc3eacffc3dad4daeb30ffd9e56523da9632/migration/layer-memoization.md).
- Registry candidate: `effect`, `@effect/platform-node`, `@effect/opentelemetry` **4.0.6**, verified available. Pin matching ecosystem versions when implementing W-24615044; do not replace unrelated tooling packages with that version.
- Einstein `main`: [`eb3355df087303eeebca510e91d480ae884b6d57`](https://github.com/forcedotcom/salesforcedx-vscode-einstein-gpt/tree/eb3355df087303eeebca510e91d480ae884b6d57), lockfile resolves Effect **3.21.2**.
- IAC `afv-v3.0-iac`: [`40afcd44967ac3665511217886f04beb81d0a141`](https://github.com/forcedotcom/salesforcedx-vscode-einstein-gpt/tree/40afcd44967ac3665511217886f04beb81d0a141). `main:.github/workflows/iac-release.yml` explicitly checks out this branch; default-branch search cannot replace this audit.
- Effect LS documentation: [`cb91d700a10e86de46d57b94261d4dcc9c92fc20`](https://github.com/Effect-TS/language-service/tree/cb91d700a10e86de46d57b94261d4dcc9c92fc20). Registry latest **0.87.5**; verify selected package against V4 negative controls, not just its README.

## Frozen external contracts

Einstein files at the revision above: `packages/extension/src/services/auth/org-service.ts` and `org-display-alias.ts`.

| Existing services member                        | Required behavior                                                                                                                                                                                                                                                                       |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ConnectionService.getConnection()`             | Genuine V3 static service accessor; returns V3 Effect. Context provisioning through consumer-owned `Layer.succeedContext(prebuiltServicesDependencies)`. Same plain `@salesforce/core` Connection identity as V4; supports `Org.create({ connection })` and arbitrary Connection calls. |
| `TargetOrgRef()`                                | V3 Effect returning a stable genuine V3 `SubscriptionRef`. `.changes` emits initial snapshot, then updates; consumer maps `orgId`, calls `Stream.changes`, then `Stream.drop(1)`.                                                                                                       |
| `prebuiltServicesDependencies`                  | Genuine V3 Context keyed by the exported V3 tags. Not a Layer or cast of the V4 Context.                                                                                                                                                                                                |
| `AliasService.getAliasesFromUsername(username)` | V3 accessor using the same Context; returns aliases for the resolved username without changing the selected org. Newly observed since the original epic draft.                                                                                                                          |
| `ConfigService.getTargetOrg()`                  | V3 accessor using the same Context; returns configured alias/username or `undefined`, used to disambiguate multiple aliases. Newly observed since the original epic draft.                                                                                                              |

Retain `prebuiltServicesLayer` as a genuine V3 Layer containing those instances and the redacting logger, preserving the documented provisioning alternative ([ADR 0007](../adr/0007-reuse-prebuilt-services-dependencies.md)). It does not implicitly install the OTEL tracer. No new `api.v1` alias: existing `api.services` already names the compatibility entry; an unused alias adds maintenance without functionality.

IAC `src/services/CoreExtensionService.ts`: preserve core `ChannelService.getInstance`, `WorkspaceContext.getInstance(false)` and its Connection access, `CommandEventDispatcher.getInstance`, `workspaceContextUtils.getOrgShape(username)`, and service-provider telemetry initialization. Do not restore unused `SalesforceProjectConfig` exports: IAC accepts their absence.

Other census members rechecked at their current default-branch revisions (verify release workflows before cutover):

- vscode-agents [`2ccdf65b05729b6b4ff548433818b1457c3d61bc`](https://github.com/forcedotcom/vscode-agents/blob/2ccdf65b05729b6b4ff548433818b1457c3d61bc/src/services/coreExtensionService.ts): core Channel/Telemetry/Workspace services.
- metadata-visualizer [`76cd8f0dafa86653a368b541c557f32ad7a420d5`](https://github.com/forcedotcom/salesforce-metadata-visualizer/blob/76cd8f0dafa86653a368b541c557f32ad7a420d5/packages/visualizer-vscode-ext/src/services/CoreExtensionService.ts): core `TelemetryService.getInstance`.
- code-analyzer [`e569a3f80055cc8071fbf44f44382e081f4213b7`](https://github.com/forcedotcom/sfdx-code-analyzer-vscode/blob/e569a3f80055cc8071fbf44f44382e081f4213b7/src/lib/external-services/external-service-provider.ts): core `WorkspaceContext.getInstance` and service-provider telemetry initialization.

UI-preview's vendored utils fork is not a direct API contract here. Inspect newly discovered production references before restricting V1; don't infer absence from default-branch search alone.

## One owner, two runtime protocols

- Services extension acquires the V4 graph once; all first-party consumers select `api.v2.services` explicitly and reuse its prebuilt instances. No `.Default`/`layer` rebuild of a prebuilt service.
- Compatibility implementation has a direct pinned V3 dependency; V4 stays the ordinary first-party `effect` dependency after cutover. Separate module/package resolution, never a global override collapsing the majors.
- Each retained V3 accessor resolves a genuine V3 service from the supplied V3 Context. The instance delegates through the already-owned V4 runtime/context; no V4 Layer is passed into a V3 runner. Plain Connection objects cross without wrapping or cloning.
- V3 caller cancellation interrupts its corresponding V4 fiber and waits for finalizers before completing. Disposal rejects/stops new bridge work, interrupts and awaits in-flight work and ref subscriptions, then closes the owning V4 runtime. Repeated disposal must release each resource once.
- Typed failures preserve their original tagged payload; defects stay defects, interruptions stay interruptions. V4 Cause has flat reasons and cannot restore V3 sequential/parallel topology. Translate every reason in deterministic order into a V3 Cause without dropping mixed failures; document that topology is unavailable, test error/defect/interruption combinations and failing finalizers. No `first failure` catch-all conversion.
- Do not promise arbitrary V3 caller FiberRefs, spans, scheduler state or dependency overrides affect V4 internals. Exported V3 service replacement still works at its V3 Context boundary. Audit any externally used `.Default`, layer overrides or additional accessors before restricting them.

## Org-ref consistency

W-24615046's [bridge contract and verification](effect-v3-compatibility-bridge.md)
define the concrete Promise/data boundary, resource ownership and acknowledged org
commit protocol. Live binding remains W-24615059.

- V4 owns authoritative org state and watchers. The V3 ref is a compatibility view, not a second source of org selection.
- Subscribe before publishing exports. Initialize both views before activation resolves; no missed update between snapshot and subscription.
- Serialize org commits: update the compatibility ref before acknowledging the corresponding V4 org-change operation. After a completed change, immediate reads from either API must agree. Preserve rapid-update order and initial snapshot semantics for every subscriber; do not prepend a duplicate initial value.
- The audited external consumer reads/subscribes only. Direct external writes to the returned V3 ref remain local ref mutations, as with any mutable reference; they do not select an org. The next authoritative org commit replaces that local snapshot. Test this behavior rather than pretending external mutation is impossible.
- Extension shutdown closes subscriptions before V4 state disposal. Test racing initialization, rapid switches, cancellation and deactivation, with singleton/watch counts.

## Published declarations

- Existing `@salesforce/vscode-services` root retains the legacy externally required V3 API type. Generate it from the compatibility surface, not by re-exporting migrated V4 implementation declarations.
- Publish `@salesforce/vscode-services-v2` separately with its own V4 dependency. The legacy package retains V3 `effect` and must not depend on or re-export the V4 package. No package-wide optional V4 peer on the V3 package: optional peers still reject an installed incompatible V3 version. No `/v2` subpath that makes the root package require both dependency protocols.
- Runtime activation returns both `services` and `v2.services`; consumer-local structural types remain valid. Internal providers request the V2 entry/type. Never repoint `api.services` or the existing package root to V4.
- Replace `generateEntry.ts` / `syncDeps.ts`'s unconditional parent-service dependency/type copying. Packed legacy consumer fixture must install and typecheck with V3 and no installed V4; separate V2-package fixture must install and typecheck with V4. A root import must not transitively load V4 through an activation-return-type alias. Test independently installed/bundled V3 **3.21.2**, then every other supported locked consumer version discovered in the refreshed census. Do not infer arbitrary V3 minor-version compatibility from matching runtime results.

W-24615044 establishes the real `@salesforce/vscode-services-v2` package with
package-owned V4 Connection/Alias/Config/org-ref keys, schemas and typed failures.
These are the initial contracts for later migrated implementation layers, not
handwritten fixture declarations or a claim that production `api.v2` activation
already exists. W-24615046 implements adapters, W-24615059 binds real connection/org
instances, W-24615069 completes the surface, and W-24615075 completes consumers and
publication integration. Do not redeclare the V4 keys in those implementations.
Registry publication waits for coordinated cutover. Legacy declarations are frozen
from the validated V3 provider at `6e0c02183a16b590a227bac5bc7c1f41f764289e`;
only their release version tracks the provider thereafter.

## Inventory and WI ownership

Reproduce every tracked static import/re-export, dynamic literal import/require, import type and direct dependency with `node scripts/effect-v4-inventory.mjs`. Output includes file paths, module specifiers, manifests and dependency sections; tests/fakes and root scripts are included. Generated declarations/build output are deliberately excluded. Check computed/dynamic module loading separately before final cutover; the script is a source census, not a bundle proof.

All files in each package belong to its WI below; no source/test import is exempt. Packages with no current Effect import/dependency need no migration unless new inventory findings add them.

| Package / paths                                                                                                                                                       | WI                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `salesforcedx-apex`, shared domain/schema prerequisites                                                                                                               | W-24615048                                                                             |
| `salesforcedx-vscode-services/src/core/executeAnonymousCompat.ts`, temporary Apex Promise/data boundary                                                               | W-24615048 introduces; W-24615069 removes                                              |
| `salesforcedx-vscode-services`: config/alias/settings/fs/workspace and foundational schemas                                                                           | W-24615055                                                                             |
| `salesforcedx-vscode-services`: connection/default-org and live compatibility binding                                                                                 | W-24615059                                                                             |
| `salesforcedx-vscode-services`: project/catalog/documents/registry/source tracking and required describe/query/ComponentSet/nonmerge-retrieve readers                     | W-24615060                                                                             |
| `salesforcedx-vscode-services`: merged workspace retrieve/deploy/delete and remaining metadata operations                                                              | W-24615063                                                                             |
| `salesforcedx-vscode-services`: remaining editor/UI/Apex/observability, activation/bootstrap                                                                          | W-24615069                                                                             |
| Compatibility-only implementation and independently installed fixtures                                                                                                | W-24615044, W-24615046                                                                 |
| `salesforcedx-vscode-services-v3-compat`: genuine V3 proxies, lifecycle and encoded host boundary                                                                     | W-24615046 introduces; W-24615059 binds actual connection graph                          |
| `salesforcedx-vscode-services-v4-implementation`: temporary isolated V4 host implementations/layers                                                                   | W-24615055 introduces; W-24615059/60/63 extend; W-24615069 folds into provider/removes |
| `effect-ext-utils`, `salesforcedx-vscode-services-types`, new V2 types package, declaration generators                                                                | W-24615075; package boundaries/installation fixtures begin W-24615044                  |
| `salesforcedx-vscode-org`, `salesforcedx-vscode-org-browser`, `salesforcedx-vscode-metadata`                                                                          | W-24615079                                                                             |
| `salesforcedx-vscode-apex-log`                                                                                                                                        | W-24615083                                                                             |
| `salesforcedx-vscode-apex-testing`                                                                                                                                    | W-24615086                                                                             |
| `salesforcedx-apex-debugger`, `salesforcedx-apex-replay-debugger`, `salesforcedx-vscode-apex-debugger`, `salesforcedx-vscode-apex-replay-debugger`                    | W-24615089                                                                             |
| `salesforcedx-vscode-soql`, `soql-builder-ui`; any newly Effect-bearing `soql-common`/`soql-model` files                                                              | W-24615093                                                                             |
| `salesforcedx-vscode-apex`, `salesforcedx-vscode-apex-oas`, `salesforcedx-vscode-lwc`, `salesforcedx-vscode-lightning`, `salesforcedx-vscode-visualforce`             | W-24615098                                                                             |
| `salesforcedx-aura-language-server`, `salesforcedx-lwc-language-server`, `salesforcedx-lightning-lsp-common`, `salesforcedx-utils-vscode`, `salesforcedx-vscode-core` | W-24615098                                                                             |
| `drivable-vscode`, `playwright-vscode-ext`, `effect-octokit`, `eslint-local-rules` test fixtures                                                                      | W-24615100                                                                             |
| Root `eslint.config.mjs`, `package.json`, `scripts/**` (including separately installed `scripts/changelogBody`), `test/**`, `.github/**` Effect helpers               | W-24615100                                                                             |
| LS/editor/CLI integration, dependency selection and diagnostic negative controls                                                                                      | W-24615044; per-slice fixes with each implementation; final enforcement W-24615101     |
| Remaining V3 dependency/import gates, coding skills/examples                                                                                                          | W-24615101                                                                             |

W-24615055 adds a private V4 implementation package to isolate its compiler/LS
program from the still-V3 provider. See [foundation ownership and verification](effect-v4-foundations.md).
W-24615059 adds the real connection graph, acknowledged org writer and compatible
lifecycle owner; see [connection ownership and verification](effect-v4-connection.md).
W-24615060 extends that graph through Project/catalog/SourceTracking and documents;
see [project/catalog ownership and verification](effect-v4-project-catalog.md).
Describe/query/ComponentSet/nonmerge-retrieve readers move into this slice as real
prerequisites. W-24615063 retains merged retrieve/deploy/delete and remaining operations.
The expected census becomes **30 packages** when that source is tracked; rerun
the inventory rather than treating the count as a fixed gate. The script excludes
quoted test source inside strings from real imports; test-fixture migration still
belongs to its package WI.

### Apex prerequisite and temporary V3 caller

W-24615048 migrates Apex's `/effect` entry before `ExecuteAnonymousService` moves
to V4. Until W-24615069, the services caller uses
`@salesforce/apex-node/execute-anonymous-compat`: a private migration-only
Promise/AbortSignal/data protocol, not a foreign runnable Effect. See
[Apex packaging and transitional contract](apex-effect-v4.md). No earlier services
graph migration or second execution implementation.

Rechecked after the stack rebase onto `1af06c186d`: the census still contains 28
packages, now including `salesforcedx-vscode-services-v2` and excluding the removed
`salesforcedx-utils-vscode`. Its paths moved into core remain owned by W-24615098;
paths moved into services follow the corresponding services WI. Do not recreate
the removed package.
The tracked frozen V3 declaration snapshot is an intentional compatibility input,
not a first-party V4 migration target. Retain upstream dependency updates when
rebasing, then intentionally refresh affected packed-consumer locks and rerun their
strict checks; never suppress manifest/lock drift assertions.

## Sequential stack and activation dependency closure

Order: W-24615037 → W-24615044 → W-24615046 → W-24615048 → W-24615055 → W-24615059 → W-24615060 → W-24615063 → W-24615069 → W-24615075 → W-24615079 → W-24615083 → W-24615086 → W-24615089 → W-24615093 → W-24615098 → W-24615100 → W-24615101 → W-24615103. Use one focused PR per WI, each based on its immediate predecessor, even where the epic permits parallel work. Self-review each PR against its parent, not the cumulative stack.

Register every PR in GitHub native stack **8542** (base `develop`), initially #8520 → #8521.
Use `gh stack link` or `gh api` with the [REST stack endpoints](https://docs.github.com/en/rest/pulls/stacks):
create with `POST /repos/forcedotcom/salesforcedx-vscode/stacks`, append with
`POST /repos/forcedotcom/salesforcedx-vscode/stacks/8542/add`, and verify ordered
membership with `GET /repos/forcedotcom/salesforcedx-vscode/stacks/8542`.
Send ordered integer `pull_requests` and API version `2026-03-10`.
Base-branch chaining or PR-body links alone do not satisfy native stack membership.

Activation currently builds the complete services graph (`servicesLayers.ts`, `index.ts`); web filesystem bootstrap also needs registry services. Intermediate service slices therefore cannot promise fully working activation. Keep those changes on a non-releasing integration stack, use focused graphs with real migrated service instances, and perform full packaged activation after W-24615069. Do not satisfy intermediate checks by constructing a duplicate full V3 service graph, disabling checks, or silently routing first-party V4 callers back to V3.

Dependency selection must also account for shared declarations and test-tool imports: introduce explicit transitional package boundaries only where necessary; remove them by W-24615101. If a slice needs an unmigrated dependency, move that prerequisite into the earlier slice or revise the integration order with documented evidence, not casts. Required branch checks remain authoritative; preparation PRs may merge independently only when fully green and release-safe.

## Effect conventions and LS gates

- V4 uses `Context.Service` with explicit `layer` composition; V3's `Effect.Service` / accessor / `.Default` rules apply only inside compatibility code. Follow upstream V4 APIs over stale V3 examples in skills, then update those skills in W-24615101.
- Preserve `Effect.fn` span names, `.pipe`, tagged schema errors, explicit dependencies and Effect-owned scoped resources. Review Schema decoding/default/optional semantics, `Either`→`Result`, removed Runtime/FiberRef APIs, Scope and flattened Causes from the selected release source.
- Keep workspace TypeScript editor configuration, `tsconfig.common.json` plugin, `config/effect-diagnostics.json`, and every per-package Wireit `check:effect-diagnostics` gate. CLI must analyze the compiled dependency tree; unresolved `unknown` imports are not proof of clean diagnostics.
- W-24615044 must run known-bad V4 files through the actual CLI and repository wrapper: floating effects, leaked `unknown` requirements/errors, nested runners and V4 service usage. Assert finding names and nonzero gate status; positive fixture must pass. Verify intentional isolated V3 is not mistaken for an accidental duplicate.
- Reconcile each existing rule with the plugin's V3/V4 support table. V3-only rules (e.g. `missingEffectServiceDependency`) cannot prove V4 layer safety; retain V3 checks where applicable and cover V4 dependencies with TypeScript/LS layer checks. Never delete an enforced rule simply to hide failures.

## Verification and cutover

Every implementation slice: frozen consumer fixtures, compile, lint, unit/integration tests, affected Effect diagnostics, Node/web bundles, dependency/declaration checks, duplicates, self `/code-review` Standards + Spec against its immediate parent, and Effect-advocate review. Record exact commands and exit status; do not inherit old POC claims. Doc-only PR runs inventory/format/link validation plus baseline checks; it does not establish migration runtime success.

Integrated services and final stack: repository-owned Playwright desktop/web commands with `--retries 0`, actual VSIX artifacts, auth/reauth/org switch, metadata operations, Apex/log/test/debugger, SOQL, language activation and tooling. Include shutdown/cancellation/finalizers, ref ordering, one cache/watcher graph, redaction and tracing. Refresh all external shipping revisions and packed type/runtime fixtures before release. Run all branch-required CI, not only local smoke tests.

No sf-effect-sdk adoption, Apex feature scope, external dependency changes or core API retirement. No partial V4 release. Merge only with required reviews/checks; keep rollback as a coordinated stack revert restoring matching manifests, lockfile and declarations, never a single mixed-major service revert. Retain `api.services` and the legacy V3 declaration package until a separately approved retirement after external consumers migrate.
