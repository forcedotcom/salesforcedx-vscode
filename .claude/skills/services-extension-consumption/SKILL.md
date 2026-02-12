---
name: services-extension-consumption
description: Guidelines for consuming salesforcedx-vscode-services extension API. Use when working with extensions that have extensionDependency on salesforcedx-vscode-services, registering commands, using Workspace/Connection/Project/Settings/FS/Channel services, or implementing file/config watchers.
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

## ExtensionContext Setup

Factory function building services layer with ExtensionContext:

```typescript
export const buildAllServicesLayer = (context: ExtensionContext) =>
  Layer.unwrapEffect(
    Effect.gen(function* () {
      const extensionProvider = yield* ExtensionProviderService;
      const api = yield* extensionProvider.getServicesApi;
      const extension = vscode.extensions.getExtension(`salesforce.${EXTENSION_NAME}`);
      const extensionVersion = extension?.packageJSON?.version ?? 'unknown';
      const o11yEndpoint = process.env.O11Y_ENDPOINT ?? extension?.packageJSON?.o11yUploadEndpoint;

      // ErrorHandlerService needs ChannelService
      const channelLayer = api.services.ChannelServiceLayer(extension?.packageJSON.displayName);
      const errorHandlerWithChannel = Layer.provide(api.services.ErrorHandlerService.Default, channelLayer);

      return Layer.mergeAll(
        ExtensionProviderServiceLive,
        api.services.ExtensionContextServiceLayer(context),
        // ... other services
        channelLayer,
        errorHandlerWithChannel
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
- [WorkspaceService](references/workspace-service.md) - Workspace info
- [ConnectionService](references/connection-service.md) - Org connections
  <<<<<<< HEAD
- [ProjectService](references/project-service.md) - Project resolution, packageDirectories
- [SettingsService](references/settings-service.md) - Settings read/write
- [FsService](references/fs-service.md) - File ops (web-compatible) and uri/path conversion
- # [EditorService](references/editor-service.md) - Active editor changes and current URI
- [ProjectService](references/project-service.md) - Project resolution
- [SettingsService](references/settings-service.md) - Settings read/write
- [FsService](references/fs-service.md) - File ops (web-compatible)
  > > > > > > > origin/develop

## Watchers

### File Watching

Watch file changes:

```typescript
const watcher = yield * api.services.FileWatcherService.watchFiles(pattern, options);

yield *
  Stream.runForEach(watcher, event =>
    Effect.sync(() => {
      // Handle file change
    })
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

Watch org changes via `TargetOrgRef`:

```typescript
const targetOrgRef = yield * api.services.TargetOrgRef();
yield *
  Effect.forkDaemon(
    targetOrgRef.changes.pipe(
      Stream.map(org => org.orgId),
      Stream.changes,
      Stream.tap(orgId => {
        // Handle org change
      }),
      Stream.runForEach(() => {
        // Refresh UI, invalidate caches, etc.
      })
    )
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
      const extension = vscode.extensions.getExtension(`salesforce.${EXTENSION_NAME}`);
      const extensionVersion = extension?.packageJSON?.version ?? 'unknown';
      const o11yEndpoint = process.env.O11Y_ENDPOINT ?? extension?.packageJSON?.o11yUploadEndpoint;

      const channelLayer = api.services.ChannelServiceLayer(extension?.packageJSON.displayName);
      const errorHandlerWithChannel = Layer.provide(api.services.ErrorHandlerService.Default, channelLayer);

      return Layer.mergeAll(
        // list whatever you need.  TS will tell you if there's somethig missing
        ExtensionProviderServiceLive,
        api.services.ConnectionService.Default,
        api.services.EditorService.Default,
        api.services.ExtensionContextServiceLayer(context),
        api.services.ProjectService.Default,
        api.services.WorkspaceService.Default,
        api.services.SdkLayerFor({ extensionName: EXTENSION_NAME, extensionVersion, o11yEndpoint }),
        channelLayer,
        errorHandlerWithChannel
      );
    }).pipe(Effect.provide(ExtensionProviderServiceLive))
  );

// index.ts
import { myCommandEffect } from './commands/myCommand';

export const activateEffect = Effect.fn(`activation:${EXTENSION_NAME}`)(function* (_context: vscode.ExtensionContext) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  yield* api.services.ChannelService.appendToChannel('Extension activating');

  // useful if registering multiple commands...they all get the layer provided to them
  const registerCommand = api.services.registerCommandWithLayer(AllServicesLayer);

  yield* registerCommand('sf.my.command', myCommandEffect);

  yield* api.services.ChannelService.appendToChannel('Extension activation complete.');
});
```

## Common Patterns

- Include `ExtensionContextServiceLayer(context)` when you have ExtensionContext
- Provide `ChannelServiceLayer` before `ErrorHandlerService`
- Use `SdkLayerFor` with extension name/version for observability
- Fork watchers with `Effect.forkIn(..., yield* getExtensionScope())` for cleanup on deactivation
- Use `registerCommandWithLayer` for all commands (tracing + error handling)
