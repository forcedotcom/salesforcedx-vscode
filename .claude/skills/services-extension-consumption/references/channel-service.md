# ChannelService

Output channel for extension messages. Accessor pattern: call methods directly.

## Creating Channel Layer

Extension-specific channel in layer setup:

```typescript
const channelLayer = api.services.ChannelServiceLayer(extension?.packageJSON.displayName);
```

## Usage

Append messages:

```typescript
yield* api.services.ChannelService.appendToChannel('Message');
```

Get OutputChannel:

```typescript
const channel = yield* api.services.ChannelService.getChannel();
```

## Examples

From `salesforcedx-vscode-metadata`:

```typescript
yield* api.services.ChannelService.appendToChannel('Salesforce Metadata extension activating');
```

## Notes

- Logging is "best effort", won't cause failures
- Use extension-specific channel via `ChannelServiceLayer`
- Provide `ChannelServiceLayer` before `ErrorHandlerService`
- `ChannelServiceLayer` is `Layer.scoped`. Finalizer disposes the cached `OutputChannel` and invalidates the cache entry when the layer scope closes (`ManagedRuntime.dispose`). Scope owns that channel.
