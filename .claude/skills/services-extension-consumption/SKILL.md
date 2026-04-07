---
name: services-extension-consumption
description: Guidelines for consuming salesforcedx-vscode-services extension API. Use when working with extensions that have extensionDependency on salesforcedx-vscode-services, registering commands, using Workspace/Connection/Project/Settings/FS/Channel/Media services, quickpick/quickInput, or implementing file/config watchers.
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

Factory function building services layer with ExtensionContext:

```typescript
export const buildAllServicesLayer = (context: ExtensionContext) =>
  Layer.unwrapEffect(
    Effect.gen(function* () {
      const extensionProvider = yield* ExtensionProviderService;
      const api = yield* extensionProvider.getServicesApi;
      const channelLayer = api.services.ChannelServiceLayer(
        context.extension.packageJSON.displayName ?? 'My Extension'
      );
      const errorHandlerWithChannel = Layer.provide(api.services.ErrorHandlerService.Default, channelLayer);

      return Layer.mergeAll(
        Layer.succeedContext(api.services.prebuiltServicesDependencies),
        ExtensionProviderServiceLive,
        errorHandlerWithChannel,
        api.services.ExtensionContextServiceLayer(context),
        api.services.SdkLayerFor(context),
        channelLayer
      );
    }).pipe(Effect.provide(ExtensionProviderServiceLive))
  );
```

In `activate`:

```typescript
export const activate = async (context: vscode.ExtensionContext): Promise<void> => {
  const extensionScope = Effect.runSync(getExtensionScope());
  setAllServicesLayer(buildAllServicesLayer(context));
  await getRuntime().runPromise(activateEffect(context).pipe(Scope.extend(extensionScope)));
};
```

## Runtime vs provide

- **Do**: Build `ManagedRuntime.make(AllServicesLayer)` and export `getRuntime()`.
- **Do**: Use `getRuntime().runPromise(effect)` / `runFork(effect)` for ad-hoc execution.
- **Don't**: Use `Effect.provide(AllServicesLayer)` at call sites — use the runtime instead.
- **Exception**: `registerCommandWithLayer(AllServicesLayer)` — keep passing the Layer; it internally uses provide.

## Registering Commands

Use `registerCommandWithLayer` (for layers) or `registerCommandWithRuntime` (for runtimes):

```typescript
import { myCommandEffect } from './commands/myCommand';

const api = yield * (yield * ExtensionProviderService).getServicesApi;

// Using Layer
const registerCommand = api.services.registerCommandWithLayer(AllServicesLayer);
yield * registerCommand('sf.my.command', myCommandEffect);

// Using Runtime
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
- [MediaService](references/media-service.md) - Icons (ICONS) and NLS descriptions
- [WorkspaceService](references/workspace-service.md) - Workspace info
- [ConnectionService](references/connection-service.md) - Org connections
- [ProjectService](references/project-service.md) - Project resolution, packageDirectories
- [SettingsService](references/settings-service.md) - Settings read/write
- [FsService](references/fs-service.md) - File ops (web-compatible) and uri/path conversion
- [EditorService](references/editor-service.md) - Active editor changes and current URI
- [Prompts](references/prompts.md) - QuickPick, InputBox, and UserCancellationError handling

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

Ref behavior (concise):

- Default-org update: username from User SOQL when present; else AuthInfo login username on the connection.
- `TargetOrgRef` snapshot without username: optional `ConfigUtil.getUsername()` (project default) before treating as no target org — see `salesforcedx-vscode-org` `orgDisplay`.

## Complete Example Pattern

```typescript
// extensionProvider.ts
import * as ManagedRuntime from 'effect/ManagedRuntime';

export const buildAllServicesLayer = (context: ExtensionContext) =>
  Layer.unwrapEffect(
    Effect.gen(function* () {
      const extensionProvider = yield* ExtensionProviderService;
      const api = yield* extensionProvider.getServicesApi;
      const channelLayer = api.services.ChannelServiceLayer(
        context.extension.packageJSON.displayName ?? 'My Extension'
      );
      const errorHandlerWithChannel = Layer.provide(api.services.ErrorHandlerService.Default, channelLayer);

      return Layer.mergeAll(
        Layer.succeedContext(api.services.prebuiltServicesDependencies),
        ExtensionProviderServiceLive,
        errorHandlerWithChannel,
        api.services.ExtensionContextServiceLayer(context),
        api.services.SdkLayerFor(context),
        channelLayer
      );
    }).pipe(Effect.provide(ExtensionProviderServiceLive))
  );

export let AllServicesLayer: ReturnType<typeof buildAllServicesLayer>;
export const setAllServicesLayer = (layer: ReturnType<typeof buildAllServicesLayer>) => {
  AllServicesLayer = layer;
};

const createRuntime = () => ManagedRuntime.make(AllServicesLayer);
let _runtime: ReturnType<typeof createRuntime> | undefined;
export const getRuntime = () => {
  _runtime ??= createRuntime();
  return _runtime;
};

// index.ts
import { myCommandEffect } from './commands/myCommand';

export const activateEffect = Effect.fn(`activation:${EXTENSION_NAME}`)(function* (_context: vscode.ExtensionContext) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  yield* api.services.ChannelService.appendToChannel('Extension activating');

  const registerCommand = api.services.registerCommandWithLayer(AllServicesLayer);

  yield* registerCommand('sf.my.command', myCommandEffect);

  yield* api.services.ChannelService.appendToChannel('Extension activation complete.');
});
```

## Common Patterns

- Start with `Layer.succeedContext(api.services.prebuiltServicesDependencies)` — don't add individual `*.Default` for services already there
- Only add per-extension layers on top
- `import { ICONS }` outside Effect; `MediaService` inside Effect
- `ChannelServiceLayer` before `ErrorHandlerService`
- Pass `context` to `SdkLayerFor` (extracts name/version from ExtensionContext)
- `Effect.forkIn(..., yield* getExtensionScope())` for watcher cleanup on deactivation
- `registerCommandWithLayer` for all commands (tracing + error handling)
- Use `getRuntime().runPromise` / `runFork` instead of `Effect.provide(AllServicesLayer)` for execution
