---
name: services-extension-consumption
description: Guidelines for consuming salesforcedx-vscode-services extension API. Use when working with extensions that have extensionDependency on salesforcedx-vscode-services, registering commands, using Workspace/Connection/Project/Settings/FS/Channel/Media services, or implementing file/config watchers.
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
  await Effect.runPromise(activateEffect(context).pipe(Effect.provide(AllServicesLayer), Scope.extend(extensionScope)));
};
```

## Registering Commands

Use `registerCommandWithLayer` pre-loaded with AllServicesLayer:

```typescript
import { myCommandEffect } from './commands/myCommand';

const api = yield * (yield * ExtensionProviderService).getServicesApi;
const registerCommand = api.services.registerCommandWithLayer(AllServicesLayer);

yield * registerCommand('sf.my.command', myCommandEffect);
```

Commands auto:

- Register with ExtensionContext subscriptions
- Wrap with error handling
- Trace with observability spans

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

## Watchers

### File Watching

FileWatcherService exposes a PubSub of all workspace file changes (`**/*`). Subscribe and filter:

```typescript
import * as PubSub from 'effect/PubSub';
import * as Stream from 'effect/Stream';

const fileWatcher = yield * api.services.FileWatcherService;
const dequeue = yield * PubSub.subscribe(fileWatcher.pubsub);

yield *
  Stream.fromQueue(dequeue).pipe(
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

## Complete Example Pattern

```typescript
// extensionProvider.ts
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
