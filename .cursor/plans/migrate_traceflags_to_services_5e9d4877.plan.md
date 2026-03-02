---
name: migrate TraceFlags to services
overview: Migrate the two consumers of the old imperative TraceFlags class (in salesforcedx-vscode-apex and salesforcedx-vscode-apex-replay-debugger) to use TraceFlagService from salesforcedx-vscode-services, then delete TraceFlags from salesforcedx-utils-vscode.
todos:
  - id: services-wiring
    content: Wire up ExtensionProviderService + AllServicesLayer in replay-debugger, create ensureTraceFlagsForCurrentUser bridge
    status: completed
  - id: migrate-quicklaunch
    content: Replace TraceFlags usage in quickLaunch.ts with ensureTraceFlagsForCurrentUser()
    status: completed
  - id: move-anon-debug
    content: Move anonApexDebug.ts, launchApexReplayDebuggerWithCurrentFile.ts, range.ts to replay-debugger; adapt imports, channels, messages
    status: completed
  - id: register-commands
    content: Register moved commands in replay-debugger index.ts + package.json activation events
    status: completed
  - id: cleanup-apex-ext
    content: Remove moved files, barrel, and command registrations from salesforcedx-vscode-apex
    status: completed
  - id: delete-traceflags
    content: Delete traceFlags.ts, remove export, dead constants, dead message keys from salesforcedx-utils-vscode
    status: completed
  - id: verify-compile
    content: npm run compile
    status: completed
  - id: verify-lint
    content: npm run lint
    status: completed
  - id: verify-test
    content: npm run test
    status: completed
  - id: verify-bundle
    content: npm run vscode:bundle
    status: completed
  - id: verify-knip
    content: npx knip
    status: completed
  - id: verify-dupes
    content: npm run check:dupes
    status: completed
isProject: false
---

# Migrate TraceFlags to TraceFlagService

## Current State

`[traceFlags.ts](packages/salesforcedx-utils-vscode/src/helpers/traceFlags.ts)` exports an imperative `TraceFlags` class with one public method: `ensureTraceFlags(): Promise<boolean>`. Two consumers:

1. `**[anonApexDebug.ts](packages/salesforcedx-vscode-apex/src/commands/anonApexDebug.ts)**` -- execute anonymous + launch replay debugger. Also pulled in by `[launchApexReplayDebuggerWithCurrentFile.ts](packages/salesforcedx-vscode-apex/src/commands/launchApexReplayDebuggerWithCurrentFile.ts)` which dispatches based on file type (.log, .apex, .cls).
2. `**[quickLaunch.ts](packages/salesforcedx-vscode-apex-replay-debugger/src/commands/quickLaunch.ts)**` -- run tests + launch replay debugger.

The replacement is `[TraceFlagService](packages/salesforcedx-vscode-services/src/core/traceFlagService.ts)` (Effect-based, already used by `salesforcedx-vscode-apex-log`).

## Approach

Both consumers belong in the replay-debugger ext (they end by launching replay debugger). The replay-debugger already has `effect` as a dep but no services integration. We add the services pattern, migrate both consumers, then delete the old code.

## 1. Wire up services in replay-debugger

- Add `salesforce.salesforcedx-vscode-services` to `extensionDependencies` in `[package.json](packages/salesforcedx-vscode-apex-replay-debugger/package.json)`
- Add `@salesforce/effect-ext-utils` to `dependencies`
- Create `src/services/extensionProvider.ts` following the [services-extension-consumption skill](/.claude/skills/services-extension-consumption/SKILL.md): `ExtensionProviderServiceLive`, `buildAllServicesLayer`, `AllServicesLayer` ref
- In `[index.ts](packages/salesforcedx-vscode-apex-replay-debugger/src/index.ts)` `activate()`, call `setAllServicesLayer(buildAllServicesLayer(context))`
- Create a thin promise bridge `ensureTraceFlagsForCurrentUser()` that runs the Effect internally, returning `Promise<boolean>` -- so existing imperative code in `quickLaunch.ts` can call it with minimal changes

```typescript
// src/services/ensureTraceFlags.ts
export const ensureTraceFlagsForCurrentUser = (): Promise<boolean> =>
  Effect.runPromise(
    Effect.gen(function* () {
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      const traceFlagService = yield* api.services.TraceFlagService;
      const userId = yield* traceFlagService.getUserId();
      yield* traceFlagService.ensureTraceFlag(userId);
      return true;
    }).pipe(
      Effect.catchAll(() => Effect.succeed(false)),
      Effect.provide(AllServicesLayer)
    )
  );
```

## 2. Migrate quickLaunch.ts (in replay-debugger)

In `[quickLaunch.ts](packages/salesforcedx-vscode-apex-replay-debugger/src/commands/quickLaunch.ts)`:

- Remove `TraceFlags` import from `@salesforce/salesforcedx-utils-vscode`
- Replace `new TraceFlags(connection).ensureTraceFlags()` (line 56) with `ensureTraceFlagsForCurrentUser()`
- No other changes needed -- the rest of `quickLaunch.ts` stays imperative

## 3. Move anonApexDebug + launchApexReplayDebuggerWithCurrentFile to replay-debugger

Move from `salesforcedx-vscode-apex/src/commands/`:

- `anonApexDebug.ts` -> `salesforcedx-vscode-apex-replay-debugger/src/commands/anonApexDebug.ts`
- `launchApexReplayDebuggerWithCurrentFile.ts` -> same
- `range.ts` (4-line `getZeroBasedRange` utility) -> same

Adaptation needed:

- Replace `TraceFlags` with `ensureTraceFlagsForCurrentUser()`
- Replace `getVscodeCoreExtension().exports.WorkspaceContext.getInstance().getConnection()` with getting connection from services (or keep using the core extension API since it's already available in replay-debugger)
- Replace `../channels` refs with replay-debugger's own `channelService`
- Move message keys (`apex_execute_text`, `apex_execute_compile_success`, `apex_execute_runtime_success`, etc.) to replay-debugger's messages
- Add `sf.anon.apex.debug.delegate`, `sf.apex.debug.document`, `sf.launch.apex.replay.debugger.with.current.file` command registrations to replay-debugger's `[index.ts](packages/salesforcedx-vscode-apex-replay-debugger/src/index.ts)`
- Add corresponding activation events in replay-debugger's `package.json`

## 4. Clean up salesforcedx-vscode-apex

In `[salesforcedx-vscode-apex](packages/salesforcedx-vscode-apex)`:

- Delete `src/commands/anonApexDebug.ts`, `src/commands/launchApexReplayDebuggerWithCurrentFile.ts`, `src/commands/range.ts`
- Delete `src/commands/index.ts` (barrel file that only exported those two)
- Remove the 3 command registrations from `[index.ts](packages/salesforcedx-vscode-apex/src/index.ts)`: `sf.anon.apex.debug.delegate`, `sf.apex.debug.document`, `sf.launch.apex.replay.debugger.with.current.file`
- Remove dead imports: `anonApexDebug`, `launchApexReplayDebuggerWithCurrentFile`

## 5. Delete TraceFlags from salesforcedx-utils-vscode

In `[salesforcedx-utils-vscode](packages/salesforcedx-utils-vscode)`:

- Delete `[src/helpers/traceFlags.ts](packages/salesforcedx-utils-vscode/src/helpers/traceFlags.ts)`
- Remove `export { TraceFlags } from './helpers/traceFlags'` from `[src/index.ts](packages/salesforcedx-utils-vscode/src/index.ts)`
- Remove now-dead constants from `[src/constants.ts](packages/salesforcedx-utils-vscode/src/constants.ts)`: `APEX_CODE_DEBUG_LEVEL`, `VISUALFORCE_DEBUG_LEVEL`, `TRACE_FLAG_EXPIRATION_KEY` (none are exported from the package or used elsewhere)
- Remove dead message keys from `[src/messages/i18n.ts](packages/salesforcedx-utils-vscode/src/messages/i18n.ts)`: `trace_flags_unknown_user`, `trace_flags_failed_to_create_debug_level`

## 6. Verification

- `npm run compile`
- `npm run lint`
- `npm run test`
- `npm run vscode:bundle`
- `npx knip` -- confirm no dead exports remain
- `npm run check:dupes`
