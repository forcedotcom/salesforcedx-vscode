# ChannelService

Output channel for extension messages. Accessor pattern: call methods directly.

## Creating Channel Layer

Extension-specific channel in layer setup:

```typescript
const channelLayer = api.v2.services.ChannelServiceLayer(extension?.packageJSON.displayName ?? 'Extension');
```

## Usage

Append messages:

```typescript
yield* api.v2.services.ChannelService.use(service => service.appendToChannel('Message'));
```

Get OutputChannel:

```typescript
const channel = yield* api.v2.services.ChannelService.use(service => service.getChannel());
```

## Examples

From `salesforcedx-vscode-metadata`:

```typescript
yield* api.v2.services.ChannelService.use(service =>
  service.appendToChannel('Salesforce Metadata extension activating')
);
```

## Notes

- Logging is "best effort", won't cause failures
- Use extension-specific channel via `ChannelServiceLayer`
- Provide `ChannelServiceLayer` before `ErrorHandlerService`
- `ChannelServiceLayer` owns the cached `OutputChannel` in its scope. Its finalizer disposes the channel and invalidates the cache entry when the layer scope closes (`ManagedRuntime.dispose`).
