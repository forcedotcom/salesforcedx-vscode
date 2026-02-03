---
name: Convert to PubSub
overview: Convert SettingsService's configurationChangeStream from Stream.async to PubSub pattern (like FileWatcherService), then update configWatcher to subscribe to the PubSub instead of directly consuming the stream.
todos:
  - id: refactor-settings-service
    content: Convert SettingsService from succeed-only to scoped+succeed pattern with PubSub
    status: completed
  - id: update-config-watcher
    content: Update configWatcher to subscribe to PubSub and create streams from subscriptions
    status: completed
    dependencies:
      - refactor-settings-service
---

# Convert Configuration Change Handling to PubSub

## 1. Refactor SettingsService

In [`packages/salesforcedx-vscode-services/src/vscode/settingsService.ts`](packages/salesforcedx-vscode-services/src/vscode/settingsService.ts):

- **Add PubSub import** at top of file
- **Convert service structure**: Change from `succeed: { ... }` to having both a `scoped` section and a `succeed` section
- Move `configurationChangeStream` into `scoped` section as `pubsub`
- Keep all other methods in `succeed` section unchanged
- **Implement PubSub pattern** (following FileWatcherService model):
- Create `PubSub.sliding<vscode.ConfigurationChangeEvent>(10_000)`
- Set up `vscode.workspace.onDidChangeConfiguration` listener
- Publish events using `Effect.runSync(PubSub.publish(pubsub, event).pipe(Effect.catchAll(() => Effect.void)))`
- Add `Effect.addFinalizer` to dispose the vscode disposable
- Return `{ pubsub } as const`

## 2. Update configWatcher

In [`packages/salesforcedx-vscode-services/src/vscode/configWatcher.ts`](packages/salesforcedx-vscode-services/src/vscode/configWatcher.ts):

- **Replace both stream usages** (lines 52-57 and 59-64):
- Subscribe to PubSub: `yield* PubSub.subscribe(settingsService.pubsub)`
- Convert to stream: `Stream.fromPubSub(subscription)`
- Apply same filters, debounce, tap, and runForEach operations
- Each watcher needs its own independent subscription to the PubSub

## Implementation Notes

- **Capacity**: Use `PubSub.sliding(10_000)` like FileWatcherService (drops oldest events when full)
- **Error handling**: Wrap publish in `Effect.catchAll(() => Effect.void)` to ignore emission errors
- **Cleanup**: Both the vscode listener disposal and PubSub lifecycle are handled by Effect's scoped pattern
- **Type**: PubSub will be `PubSub.PubSub<vscode.ConfigurationChangeEvent>`