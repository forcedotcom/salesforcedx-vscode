# SettingsService

VS Code settings read/write. `getValue` and `getValueOrElse` are generic, so yield the service and call the instance method. Other methods use the generated accessor.

## Methods

### getValue

Unset → `T | undefined`.

```typescript
const settings = yield* api.v2.services.SettingsService;
const value = yield* settings.getValue<string>('section', 'key');
```

### getValueOrElse

Unset or `null` → `defaultValue`. Success type is `T`.

```typescript
const settings = yield* api.v2.services.SettingsService;
const value = yield* settings.getValueOrElse('section', 'key', false);
```

### setValue

Set a setting value (defaults to `ConfigurationTarget.Global`; pass a target to override):

```typescript
yield* api.v2.services.SettingsService.use(service => service.setValue('section', 'key', value));
yield* api.v2.services.SettingsService.use(service =>
  service.setValue('section', 'key', value, vscode.ConfigurationTarget.Workspace)
);
```

### getInstanceUrl

Get instance URL (web):

```typescript
const url = yield* api.v2.services.SettingsService.use(service => service.getInstanceUrl());
```

### getAccessToken

Web access token as `Redacted.Redacted<string>` (`toString` → `<redacted>`). Unwrap with `Redacted.value` only for the connection cache key / Salesforce Core auth:

```typescript
const token = yield* api.v2.services.SettingsService.use(service => service.getAccessToken());
```

### getApiVersion

Get API version (web):

```typescript
const version = yield* api.v2.services.SettingsService.use(service => service.getApiVersion());
```

### setInstanceUrl

Set instance URL (web):

```typescript
yield* api.v2.services.SettingsService.use(service => service.setInstanceUrl(url));
```

### setAccessToken

Set access token (web):

```typescript
yield* api.v2.services.SettingsService.use(service => service.setAccessToken(token));
```

### setApiVersion

Set API version (web):

```typescript
yield* api.v2.services.SettingsService.use(service => service.setApiVersion(version));
```

### getRetrieveOnLoad

Get retrieve on load setting:

```typescript
const value = yield* api.v2.services.SettingsService.use(service => service.getRetrieveOnLoad());
```

### getInternalDev

`salesforcedx-vscode-core.internal-development`. Unset/`null` → `false`.

```typescript
const internalDev = yield* api.v2.services.SettingsService.use(service => service.getInternalDev());
```

## Errors

- `SettingsError` - Setting read/write failed

## Examples

From `salesforcedx-vscode-services`:

```typescript
const instanceUrl = yield* api.v2.services.SettingsService.use(service => service.getInstanceUrl());
const accessToken = yield* api.v2.services.SettingsService.use(service => service.getAccessToken());
const apiVersion = yield* api.v2.services.SettingsService.use(service => service.getApiVersion());
```

## Notes

- Web methods (instanceUrl, accessToken, apiVersion) use `CODE_BUILDER_WEB_SECTION`
- `setValue` defaults to `ConfigurationTarget.Global`; pass a `target` arg (e.g. `Workspace`) to override
- Empty strings = missing for web settings
- Default API version: '64.0'
- `getAccessToken` Redacted vs span redaction: `packages/salesforcedx-vscode-services/CONTEXT.md` glossary
