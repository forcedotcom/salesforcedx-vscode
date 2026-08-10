---
name: services-extension-consumption
description: Consume the salesforcedx-vscode-services extension API. Use when an extension depends on salesforcedx-vscode-services and you are registering commands, calling its services (Workspace, Connection, Project, Settings, FS, Channel, Media, prompts), watching files/config/target-org, or wiring the AllServicesLayer/runtime in extensionProvider.ts.
review: always
---

# Consuming salesforcedx-vscode-services

Extensions depending on `salesforcedx-vscode-services`. Examples: `salesforcedx-vscode-metadata`, `salesforcedx-vscode-org-browser`.

## Getting the API

Use `ExtensionProviderService` from `@salesforce/effect-ext-utils`:

```typescript
import { ExtensionProviderService, getServicesApi } from '@salesforce/effect-ext-utils';

const ExtensionProviderServiceLive = Layer.effect(
  ExtensionProviderService,
  Effect.sync(() => ({
    getServicesApi
  }))
);

// In an Effect.gen:
const api = yield * (yield * ExtensionProviderService).getServicesApi;
```

## Prebuilt vs Per-Extension Services

`api.services.prebuiltServicesDependencies` — pre-built `Context.Context` from services extension activation. Wrap with `Layer.succeedContext(...)`.

Shares singleton instances (caches, watchers) across extensions; avoids re-building stateful services.

Per-extension layers (must build yourself):

| Layer                                   | Why                                                        |
| --------------------------------------- | ---------------------------------------------------------- |
| `ChannelServiceLayer(displayName)`      | Own output channel                                         |
| `ErrorHandlerService.Default`           | Depends on own ChannelService                              |
| `ExtensionContextServiceLayer(context)` | Own `ExtensionContext`                                     |
| `SdkLayerFor(context)`                  | Own tracer (extension name/version in resource attributes) |
| `ExtensionProviderServiceLive`          | Local singleton                                            |

## ExtensionContext Setup

Preferred: import `buildAllServicesLayer` from `@salesforce/effect-ext-utils`. It reads `displayName` from `package.json`, falling back to the second arg. `services/extensionProvider.ts` only needs the mutable `AllServicesLayer` + setter:

```typescript
// services/extensionProvider.ts
import { buildAllServicesLayer } from '@salesforce/effect-ext-utils';

export let AllServicesLayer: ReturnType<typeof buildAllServicesLayer>;
export const setAllServicesLayer = (layer: ReturnType<typeof buildAllServicesLayer>) => {
  AllServicesLayer = layer;
};
```

In `activate` — pass the context and a localized fallback channel name:

```typescript
import { buildAllServicesLayer } from '@salesforce/effect-ext-utils';
import { nls } from './messages';
import { setAllServicesLayer } from './services/extensionProvider';

export const activate = async (context: vscode.ExtensionContext): Promise<void> => {
  setAllServicesLayer(buildAllServicesLayer(context, nls.localize('channel_name')));
  await getRuntime().runPromise(activateEffect(context));
};
```

Two patterns exist depending on whether the extension adds services beyond the shared base:

- **Shared base only** (`core`, `apex`, `apex-testing`, `lightning`, `lwc`, `org`, `visualforce`): import `buildAllServicesLayer` directly from `@salesforce/effect-ext-utils` and pass it to `setAllServicesLayer` at activation. No local factory needed.
- **Extension-specific services added** (`apex-debugger`, `apex-log`, `apex-oas`, `apex-replay-debugger`, `metadata`, `org-browser`, `soql`): define a local `buildAllServicesLayer` in `services/extensionProvider.ts` that calls `buildSharedServicesLayer` from `@salesforce/effect-ext-utils` and merges the extension's own Effect services via `Layer.mergeAll`. The extra services vary — `apex-oas` adds `ApexMetadataService` and `LLMService`; extensions with the notifications system add `NotificationModeService.Default`; `org-browser` adds `OrgBrowserRetrieveService`.

## Runtime vs provide

- **Do**: Build `ManagedRuntime.make(AllServicesLayer)` and export `getRuntime()`.
- **Do**: Export runtime disposal, clear the memo, and call it during extension deactivation.
- **Do**: Use `getRuntime().runPromise(effect)` / `runFork(effect)` for ad-hoc execution.
- **Don't**: Use `Effect.provide(AllServicesLayer)` at call sites — use the runtime instead.

```typescript
export const disposeRuntime = async (): Promise<void> => {
  if (_runtime) {
    await _runtime.dispose();
    _runtime = undefined;
  }
};

export const deactivate = async (): Promise<void> => {
  await getRuntime().runPromise(deactivation()).finally(disposeRuntime);
};
```

## Resource Lifecycle

Prefer Effect scope ownership for resources created inside Effect services/layers:

- Define resource-owning services with `scoped`.
- Register VS Code `Disposable`s with `Effect.addFinalizer`.
- Attach long-lived fibers to the owning scope with `Effect.forkIn`.
- Dispose the owning `ManagedRuntime` on deactivation so layer finalizers run.
- Don't expose `runDispose`/`dispose` solely for consumers to add to `context.subscriptions`.
- Keep `context.subscriptions` for resources created outside an Effect scope.

Allocation and cleanup stay together. See `../effect-best-practices/SKILL.md#effect-owned-resources`.

## Registering Commands

Use `registerCommandWithRuntime`:

```typescript
import { myCommandEffect } from './commands/myCommand';

const api = yield * (yield * ExtensionProviderService).getServicesApi;

const registerCommand = api.services.registerCommandWithRuntime(getRuntime());
yield * registerCommand('sf.my.command', myCommandEffect);
```

Commands auto:

- Register with ExtensionContext subscriptions
- Wrap with error handling
- Trace with observability spans
- Handle Cancellation

### Success handling

`Effect.fn` accepts middleware args after the generator. Put success-side middleware **before** `catchTag`/`catchAll` — otherwise caught errors become successes.

```typescript
export const deployActiveEditorCommand = Effect.fn('deploySourcePath.deployActiveEditor')(
  function* () {
    // ...core logic...
  },
  // runs only on success — placed before catchTag
  withConfigurableSuccessNotification(nls.localize('command_succeeded_text', label)),
  // catches errors — placed after success middleware
  Effect.catchTag('NoActiveEditorError', () =>
    Effect.promise(() => vscode.window.showErrorMessage(nls.localize('deploy_select_file_or_directory'))).pipe(
      Effect.as(undefined)
    )
  )
);
```

`withConfigurableSuccessNotification` wraps the effect with `Effect.tap`, so it only fires when the effect succeeds:

```typescript
export const withConfigurableSuccessNotification =
  (message: string) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    Effect.tap(effect, () =>
      Effect.sync(() => {
        const show = vscode.workspace.getConfiguration(SECTION).get<boolean>(KEY, false);
        if (show) void vscode.window.showInformationMessage(message);
      })
    );
```

## Invoking `sf.org.login.web`

Cross-extension / `executeCommand`: `vscode.commands.executeCommand('sf.org.login.web', instanceUrl?, reauthAliasOrUsername?)`.

- No args: interactive flow (palette).
- With `instanceUrl`: skips org-type quick pick.
- Second arg applies only when `instanceUrl` was provided: trimmed non-empty string becomes the auth alias (access-token re-auth); else alias defaults to `reauth-vscodeOrg`.

## Basic Services

Accessor pattern: call methods directly, don't assign to variable first.

- [ChannelService](references/channel-service.md) - Output channel
- [ComponentSetService](references/component-set-service.md) - Build component sets (source, manifest, URIs)
- [MediaService](references/media-service.md) - Icons (ICONS) and NLS descriptions
- [WorkspaceService](references/workspace-service.md) - Workspace info
- [ConnectionService](references/connection-service.md) - Org connections
- [ProjectService](references/project-service.md) - Project resolution, packageDirectories
- [SettingsService](references/settings-service.md) - Settings read/write
- [FsService](references/fs-service.md) - File ops (web-compatible), uri/path conversion, `HashableUri` (value-based URI equality for HashSet/HashMap keys)
- [EditorService](references/editor-service.md) - Active editor changes and current URI
- [Prompts](references/prompts.md) - QuickPick, InputBox, and UserCancellationError handling
- [TerminalService](references/terminal-service.md) - Run shell commands (desktop-only)
- [NotificationModeService](references/notification-mode-api.md) - Configurable success notifications

## Watchers

### File Watching

FileWatcherService exposes a PubSub of all workspace file changes (`**/*`). Subscribe and filter:

```typescript
import * as PubSub from 'effect/PubSub';
import * as Stream from 'effect/Stream';

const fileWatcher = yield * api.services.FileWatcherService;

yield* Stream.fromPubSub(fileWatcher.pubsub).pipe(
    Stream.filter(event => /* match event.uri to your pattern */),
    Stream.runForEach(event =>
      Effect.sync(() => {
        // Handle event: { type: 'create'|'change'|'delete', uri }
      })
    )
  );
```

### Config Watching

Watch VS Code config changes:

```typescript
import * as PubSub from 'effect/PubSub';
import * as Stream from 'effect/Stream';
import * as Duration from 'effect/Duration';

const pubsub = yield * PubSub.sliding<vscode.ConfigurationChangeEvent>(100);
const disposable = vscode.workspace.onDidChangeConfiguration(event => {
  Effect.runSync(PubSub.publish(pubsub, event));
});

yield *
  Effect.addFinalizer(() =>
    Effect.sync(() => {
      disposable?.dispose();
    })
  );

yield *
  Stream.fromPubSub(pubsub).pipe(
    Stream.filter(event => event.affectsConfiguration('section.setting')),
    Stream.debounce(Duration.millis(100)),
    Stream.runForEach(() => {
      // Handle config change
    })
  );
```

### Target Org Changes

Watch org changes via `TargetOrgRef` (SubscriptionRef):

```typescript
const ref = yield * api.services.TargetOrgRef();
yield *
  ref.changes.pipe(
    Stream.map(org => org.orgId),
    Stream.changes,
    Stream.tap(orgId => {
      // Handle org change
    }),
    Stream.runForEach(() => {
      // Refresh UI, invalidate caches, etc.
    })
  );
```

`TargetOrgRef` is a `SubscriptionRef`: `ref.changes` already emits the current value first, so never prepend an explicit get. See the SubscriptionRef section of `../effect-best-practices/SKILL.md` for the mechanic (incl. `Stream.drop(1)` to skip the initial snapshot).

Ref behavior (concise):

- Default-org update: username from User SOQL when present; else AuthInfo login username on the connection.
- `TargetOrgRef` snapshot without username: optional `ConfigUtil.getUsername()` (project default) before treating as no target org.
- `TargetOrgRef` value is always an object (never `undefined`); only fields like `orgId` within it are optional.

## Complete Example Pattern

```typescript
// services/extensionProvider.ts
import { buildAllServicesLayer } from '@salesforce/effect-ext-utils';

export let AllServicesLayer: ReturnType<typeof buildAllServicesLayer>;
export const setAllServicesLayer = (layer: ReturnType<typeof buildAllServicesLayer>) => {
  AllServicesLayer = layer;
};

// services/runtime.ts
import * as ManagedRuntime from 'effect/ManagedRuntime';
import { AllServicesLayer } from './extensionProvider';

const createRuntime = () => ManagedRuntime.make(AllServicesLayer);
let _runtime: ReturnType<typeof createRuntime> | undefined;
export const getRuntime = () => (_runtime ??= createRuntime());

// index.ts
import { buildAllServicesLayer } from '@salesforce/effect-ext-utils';
import { nls } from './messages';
import { myCommandEffect } from './commands/myCommand';
import { setAllServicesLayer } from './services/extensionProvider';
import { getRuntime } from './services/runtime';

export const activate = async (context: vscode.ExtensionContext) => {
  setAllServicesLayer(buildAllServicesLayer(context, nls.localize('channel_name')));
  await getRuntime().runPromise(activateEffect(context));
};

export const activateEffect = Effect.fn(`activation:${EXTENSION_NAME}`)(function* (_context: vscode.ExtensionContext) {
  const providerService = yield* ExtensionProviderService;
  const api = yield* providerService.getServicesApi;
  yield* api.services.ChannelService.appendToChannel('Extension activating');

  const registerCommand = api.services.registerCommandWithRuntime(getRuntime());
  yield* registerCommand('sf.my.command', myCommandEffect);

  yield* api.services.ChannelService.appendToChannel('Extension activation complete.');
});
```

## Testing

Mock services via `Layer.succeed` and combine with `Layer.mergeAll`. For static accessors (e.g., `api.services.WorkspaceService.getWorkspaceInfo()`), wire both the provider and service:

```typescript
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import { WorkspaceService } from 'salesforcedx-vscode-services/src/vscode/workspaceService';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';

// Mock both ExtensionProviderService and WorkspaceService
const mockWorkspaceLayer = Layer.mergeAll(
  Layer.succeed(ExtensionProviderService, {
    getServicesApi: Effect.succeed({
      services: { WorkspaceService } // Accessor sees real class
    } as unknown as SalesforceVSCodeServicesApi)
  }),
  Layer.succeed(
    WorkspaceService,
    new WorkspaceService({
      getWorkspaceInfo: () => Effect.succeed({ path: '/mock', fsPath: '/mock', isEmpty: false, isVirtualFs: false, cwd: '/mock' }),
      getWorkspaceInfoOrThrow: () => Effect.succeed(/* ... */)
    } as unknown as WorkspaceService)
  )
);

// Use in test
const result = await Effect.runPromise(
  myEffect().pipe(Effect.provide(mockWorkspaceLayer))
);
```

For direct service mocking (no accessor), use `Layer.succeed(Service, mockImpl)` alone.

## Common Patterns

- Start with `Layer.succeedContext(api.services.prebuiltServicesDependencies)` — don't add individual `*.Default` for services already there
- Only add per-extension layers on top
- `import { ICONS }` outside Effect; `MediaService` inside Effect
- `ChannelServiceLayer` before `ErrorHandlerService`
- Pass `context` to `SdkLayerFor` (extracts name/version from ExtensionContext)
- `Effect.forkIn(..., yield* getExtensionScope())` for watcher cleanup on deactivation
- Scoped services own their VS Code disposables via finalizers; runtime disposal runs them
- `registerCommandWithRuntime` for all commands (tracing + error handling)
- Use `getRuntime().runPromise` / `runFork` instead of `Effect.provide(AllServicesLayer)` for execution

## Don't: rebuild services already in prebuiltServicesDependencies

```typescript
// WRONG — creates new singleton instances, duplicating caches/watchers/state
return Layer.mergeAll(
  ExtensionProviderServiceLive,
  api.services.ExtensionContextServiceLayer(context),
  api.services.FsService.Default,           // ← already in prebuilt
  api.services.AliasService.Default,        // ← already in prebuilt
  api.services.SdkLayerFor(context),
  channelLayer,
  errorHandlerWithChannel
);

// CORRECT — share the already-built singletons
return Layer.mergeAll(
  Layer.succeedContext(api.services.prebuiltServicesDependencies),
  ExtensionProviderServiceLive,
  api.services.ExtensionContextServiceLayer(context),
  api.services.SdkLayerFor(context),
  channelLayer,
  errorHandlerWithChannel
);
```

## Review

Invoke the `effect-advocate` subagent on plans and diffs — its top-priority finding category is "you re-implemented something that already exists in `salesforcedx-vscode-services`."

`prebuiltServicesDependencies` contains ~27 services built once during services extension activation. Calling `.Default` on any of them creates a **second instance** with its own caches, watchers, and state — silently breaking cross-extension sharing.
