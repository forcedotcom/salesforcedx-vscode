---
name: services-extension-consumption
description: Consume the salesforcedx-vscode-services extension API. Use when an extension depends on salesforcedx-vscode-services and you are registering commands, calling its services (Workspace, Connection, Project, Settings, FS, Channel, Media, prompts), watching files/config/target-org, or wiring the AllServicesLayer/runtime in extensionProvider.ts.
review: always
---

# Consuming salesforcedx-vscode-services V2

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

`api.v2.services.prebuiltServicesLayer` — shared V4 service instances plus redacting logger context. Not the OTEL tracer. Provide or merge this layer directly.

Use only `api.v2.services` in first-party code. `api.services` is the frozen external V3 compatibility API.

Shares singleton instances (caches, watchers) across extensions; avoids re-building stateful services.

Per-extension layers (must build yourself):

| Layer                                   | Why                                                        |
| --------------------------------------- | ---------------------------------------------------------- |
| `ChannelServiceLayer(displayName)`      | Own output channel; disposed when layer scope closes       |
| `ErrorHandlerServiceLayer`              | Depends on this extension's ChannelService                |
| `ExtensionContextServiceLayer(context)` | Own `ExtensionContext`                                     |
| `SdkLayerFor(context)`                  | Own tracer (extension name/version in resource attributes) |
| `NotificationModeServiceLayer(section, id, name)` | Own status item, command, and timer                       |
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
- **Extension-specific services added** (`apex-debugger`, `apex-log`, `apex-oas`, `apex-replay-debugger`, `metadata`, `org-browser`, `soql`): merge local V4 layers with `buildAllServicesLayer`. The extra services vary — `apex-oas` adds `ApexMetadataService` and `LLMService`; use `NotificationModeServiceLayer(...)` for per-extension notification state.

## Runtime vs provide

- `buildAllServicesLayer` merges `suppressVersionMismatchWarning`. Extension code keeps `ManagedRuntime.make(AllServicesLayer)`; do not wrap it. The services activation runtime inlines `Layer.setVersionMismatchErrorLogLevel(Option.none())` because it cannot import effect-ext-utils.
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

const registerCommand = api.v2.services.registerCommandWithRuntime(getRuntime());
yield * registerCommand('sf.my.command', myCommandEffect);
```

Commands auto:

- Register with ExtensionContext subscriptions
- Wrap with error handling
- Trace with observability spans
- Handle Cancellation

### Activation ordering

`activate()` awaits `getRuntime().runPromise(activateEffect(context))`; it does not detach the main activation Effect. Only work explicitly started with `Effect.fork*` continues after activation completes.

Register all manifest-contributed UI before awaiting work that can be slow or unresolved:

1. Register tree/webview providers and put any returned `Disposable` in `context.subscriptions` when it is not scope-owned.
2. Restore the extension's persisted UI state and set its context keys.
3. Register every contributed command.
4. Set an extension-owned readiness context key only after steps 1-3 succeed, and use it to gate title/menu commands that would otherwise be visible.
5. Only then await connection resolution, target-org readiness, catalog hydration, or network work. Use `Effect.forkIn` for long-lived watchers that do not need to block activation.

`when` clauses can expose a contributed command before its handler has registered. A context key owned by another extension, including `sf:has_target_org`, is a visibility hint, not proof that this extension has initialized. Do not make a contributed handler's registration depend on it. Keep target-org and authorization checks in the command implementation or shared service layer.

```typescript
export const activateEffect = Effect.fn(`activation:${EXTENSION_NAME}`)(function* (context: vscode.ExtensionContext) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const provider = new MyTreeProvider();
  context.subscriptions.push(vscode.window.registerTreeDataProvider(VIEW_ID, provider));

  yield* setInitialContext();
  const registerCommand = api.v2.services.registerCommandWithRuntime(getRuntime());
  yield* registerCommand('sf.my.command', () => myCommand(provider));
  yield* Effect.promise(() => vscode.commands.executeCommand('setContext', 'sf:myExtension.ready', true));

  // Command registration must not wait for org-backed initialization.
  yield* api.v2.services.ConnectionService.use(service => service.getConnection());
});
```

### Success handling

`Effect.fn` middleware runs left to right after the generator. Put `Effect.tap` / success notification before recovery (`Effect.catch`, `catchCause`, `catchIf`, `catchSome`, `catchSomeCause`, `catchTag`, `catchTags`) — a success combinator after recovery also runs on the recovered value. Later guards such as `preventOrgChanges` remain valid. Lint: `local/effect-fn-catch-middleware-last` on spanned `Effect.fn` (`fn('span')`, `fn('name', options)`). Skips `fnUntraced`, unspanned `fn(function*)`, generator-body catch, and `.pipe` catch.

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
- [FsService](references/fs-service.md) - File ops (web-compatible), uri/path conversion, `HashableUri` (`comparisonKey` of URI fields, not `.toString()`)
- `OrgMetadataCatalog` - inventory/presence; `getChildren` / `getEntries` / `resolveComponents`. Types: catalog + entries, `OrgMetadataCatalogError` (type-only), `OrgMetadataComponentReference`, `OrgMetadataCatalogChange`. [ADR 0021](../../../docs/adr/0021-org-metadata-catalog.md)
- `TransmogrifierService` - REST/workspace SObject describe → canonical `SObject`. Types: `TransmogrifierService`, `TransmogrifierError` (type-only)
- [EditorService](references/editor-service.md) - Active editor changes and current URI
- [Prompts](references/prompts.md) - QuickPick, InputBox, and UserCancellationError handling
- [TerminalService](references/terminal-service.md) - Run argv commands (desktop-only)
- [NotificationModeService](references/notification-mode-api.md) - Configurable success notifications

## Watchers

### File Watching

`FileChangePubSub` — workspace FS (`**/*`), including project `.sf/config.json`. Filter `event.uri` / `uri.path` / `Utils.*`, not `uri.fsPath`.

Global `~/.sf/config.json` and `~/.sfdx/alias.json`: `HostFileWatcher` (internal, `@salesforce/core/fs`). Not on the public API; services already watch them. See [FileChangePubSub vs HostFileWatcher](../../../packages/salesforcedx-vscode-services/CONTEXT.md#filechangepubsub-vs-hostfilewatcher).

```typescript
import * as Stream from 'effect/Stream';

const pubsub = yield* api.v2.services.FileChangePubSub;

yield* Stream.fromPubSub(pubsub).pipe(
  Stream.filter(event => /* event.uri / uri.path / Utils.*; not uri.fsPath */),
  Stream.runForEach(event =>
    Effect.sync(() => {
      // { type: 'create'|'change'|'delete', uri }
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
const ref = yield* api.v2.services.TargetOrgRef;
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

- Default-org update: username from User SOQL when present; else `conn.getUsername()` / AuthInfo login username. Ref treated stale if stored username !== connection auth username; triggers re-query of username/userId/aliases/devHubOrgId. Write: re-`get` ref after queries (no async gap before `set`), merge onto it, `set` only if changed (any SubscriptionRef write publishes, even equivalent; TargetOrgRef subscribers like the org catalog treat each emission as an org change). Span annotated `stale: true` if ref's orgId moved (write dropped), else `changed` (+ `updated` if changed).
- Username-less snapshot = no target org.
- `TargetOrgRef` (`DefaultOrgInfoSchema`) value is always an object (never `undefined`); `orgId`/`devHubOrgId` optional branded `OrgId` (`Schema.optional(OrgId)`, like `cliId`).

### Clearing the Default Org

Call `ClearDefaultOrgRef()` to reset the in-process org ref (e.g., after deleting the default org):

```typescript
yield* api.v2.services.ClearDefaultOrgRef();
```

Clears the reactive ref without rewriting config. Use when the CLI already mutated config but the in-process ref must reset to notify observers (e.g., the source tracking status bar icons). See `orgDeleteDefaultCommand` for an example.

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
  yield* api.v2.services.ChannelService.use(service => service.appendToChannel('Extension activating'));

  const registerCommand = api.v2.services.registerCommandWithRuntime(getRuntime());
  yield* registerCommand('sf.my.command', myCommandEffect);

  yield* api.v2.services.ChannelService.use(service => service.appendToChannel('Extension activation complete.'));
});
```

## Testing

Mock V4 services via `Layer.succeed(Service, Service.of(mock))`. Prefer testing the service directly; test provider wiring separately.

```typescript
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import { WorkspaceService } from '@salesforce/vscode-services/v2';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';

const mockWorkspaceLayer = Layer.succeed(
  WorkspaceService,
  WorkspaceService.of({
    getWorkspaceInfo: () => Effect.succeed({ path: '/mock', fsPath: '/mock', isEmpty: false, isVirtualFs: false, cwd: '/mock' }),
    getWorkspaceInfoOrThrow: () => Effect.succeed(/* ... */)
  })
);

// Use in test
const result = await Effect.runPromise(WorkspaceService.use(service => service.getWorkspaceInfo()).pipe(Effect.provide(mockWorkspaceLayer)));
```

For direct service mocking (no accessor), use `Layer.succeed(Service, mockImpl)` alone.

## Common Patterns

- Start with `api.v2.services.prebuiltServicesLayer` — don't rebuild prebuilt services
- Only add per-extension layers on top
- `import { ICONS }` outside Effect; `MediaService` inside Effect
- `ChannelServiceLayer` before `ErrorHandlerService`
- Pass `context` to `SdkLayerFor` (extracts name/version from ExtensionContext)
- `Effect.forkIn(..., yield* getExtensionScope())` for watcher cleanup on deactivation
- Scoped services own their VS Code disposables via finalizers; runtime disposal runs them
- `registerCommandWithRuntime` for all commands (tracing + error handling)
- Use `getRuntime().runPromise` / `runFork` instead of `Effect.provide(AllServicesLayer)` for execution

## Don't: rebuild services already in prebuiltServicesLayer

```typescript
// WRONG — creates new singleton instances, duplicating caches/watchers/state
return Layer.mergeAll(
  ExtensionProviderServiceLive,
  api.v2.services.ExtensionContextServiceLayer(context),
  duplicateFsLayer,                          // ← don't rebuild a service already in prebuilt
  api.v2.services.SdkLayerFor(context),
  channelLayer,
  errorHandlerWithChannel
);

// CORRECT — share the already-built singletons
return Layer.mergeAll(
  api.v2.services.prebuiltServicesLayer,
  ExtensionProviderServiceLive,
  api.v2.services.ExtensionContextServiceLayer(context),
  api.v2.services.SdkLayerFor(context),
  channelLayer,
  errorHandlerWithChannel
);
```

## Review

Invoke the `effect-advocate` subagent on plans and diffs — its top-priority finding category is "you re-implemented something that already exists in `salesforcedx-vscode-services`."

`prebuiltServicesLayer` contains services built once during services activation. Rebuilding a shared service creates a second cache/watcher/state owner and breaks cross-extension sharing.
