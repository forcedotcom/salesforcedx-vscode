---
name: Add Runtime apex-log
overview: Add `getRuntime()` to apex-log extensionProvider and replace all `Effect.provide(AllServicesLayer)` call sites with `getRuntime().runPromise(effect)` / `runFork(effect)` per the services-extension-consumption skill.
todos: []
isProject: false
---

# Phase 3: Add Runtime — apex-log

## Reference pattern

From [services-extension-consumption/SKILL.md](.claude/skills/services-extension-consumption/SKILL.md) and [salesforcedx-vscode-soql extensionProvider](packages/salesforcedx-vscode-soql/src/services/extensionProvider.ts):

- Build `ManagedRuntime.make(AllServicesLayer)` and export `getRuntime()`
- Use `getRuntime().runPromise(effect)` / `runFork(effect)` for ad-hoc execution
- **Exception**: `registerCommandWithLayer(AllServicesLayer)` — keep passing the Layer

## 1. Add getRuntime() to extensionProvider

**File**: [packages/salesforcedx-vscode-apex-log/src/services/extensionProvider.ts](packages/salesforcedx-vscode-apex-log/src/services/extensionProvider.ts)

- Add `import * as ManagedRuntime from 'effect/ManagedRuntime'`
- Add lazy singleton pattern (same as soql/apex-testing):

```typescript
const createApexLogRuntime = () => ManagedRuntime.make(AllServicesLayer);
let _apexLogRuntime: ReturnType<typeof createApexLogRuntime> | undefined;
export const getRuntime = () => {
  _apexLogRuntime ??= createApexLogRuntime();
  return _apexLogRuntime;
};
```

Note: `AllServicesLayer` is re-exported from `allServicesLayerRef`; the runtime must be created after `setAllServicesLayer` is called in activate.

## 2. Replace provide at call sites

| File                                                                                                                | Current                                                                                                                                          | Change                                                                                |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| [index.ts](packages/salesforcedx-vscode-apex-log/src/index.ts)                                                      | `Effect.runPromise(activation(...).pipe(Effect.provide(AllServicesLayer), Scope.extend(...)))`                                                   | `getRuntime().runPromise(activation(...).pipe(Scope.extend(...)))`                    |
| [index.ts](packages/salesforcedx-vscode-apex-log/src/index.ts)                                                      | `Effect.runPromise(deactivation().pipe(Effect.provide(AllServicesLayer)))`                                                                       | `getRuntime().runPromise(deactivation())`                                             |
| [index.ts](packages/salesforcedx-vscode-apex-log/src/index.ts)                                                      | `onDidCloseTextDocument`: `Effect.runPromise(api.services.ExecuteAnonymousService.clearDiagnostics(...).pipe(Effect.provide(AllServicesLayer)))` | `getRuntime().runPromise(api.services.ExecuteAnonymousService.clearDiagnostics(...))` |
| [traceFlagsContentProvider.ts](packages/salesforcedx-vscode-apex-log/src/traceFlags/traceFlagsContentProvider.ts)   | `Effect.runPromise(fetchTraceFlagsContent().pipe(Effect.provide(AllServicesLayer), ...))`                                                        | `getRuntime().runPromise(fetchTraceFlagsContent().pipe(...))`                         |
| [traceFlagsCodeLensProvider.ts](packages/salesforcedx-vscode-apex-log/src/traceFlags/traceFlagsCodeLensProvider.ts) | `provideTraceFlagsCodeLens(...).pipe(Effect.provide(AllServicesLayer), ...).pipe(Effect.runPromise)`                                             | `getRuntime().runPromise(provideTraceFlagsCodeLens(...).pipe(...))`                   |
| [executeAnonymous.ts](packages/salesforcedx-vscode-apex-log/src/commands/executeAnonymous.ts)                       | `Effect.runPromise(executeAnonymous(context).pipe(Effect.provide(AllServicesLayer)))`                                                            | `getRuntime().runPromise(executeAnonymous(context))`                                  |

## 3. Import updates

- **index.ts**: Add `getRuntime` to import from `./services/extensionProvider`; remove `AllServicesLayer` from activation/deactivation/onDidCloseTextDocument usage (keep for `registerCommandWithLayer`)
- **traceFlagsContentProvider.ts**: Change import from `AllServicesLayer` to `getRuntime` from `../services/extensionProvider`
- **traceFlagsCodeLensProvider.ts**: Change import from `AllServicesLayer` to `getRuntime` from `../services/extensionProvider`
- **executeAnonymous.ts**: Change import from `AllServicesLayer` to `getRuntime` from `../services/extensionProvider`

## 4. Verification

Per [verification SKILL](.claude/skills/verification/SKILL.md): compile, lint, test, bundle, knip, check:dupes. Delegate to verifier subagent.
