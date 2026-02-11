# SettingsService

VS Code settings read/write. Accessor pattern: call methods directly.

## Methods

### getValue

Get a setting value:

```typescript
const value = yield* api.services.SettingsService.getValue('section', 'key', defaultValue);
```

### setValue

Set a setting value:

```typescript
yield* api.services.SettingsService.setValue('section', 'key', value);
```

### getInstanceUrl

Get instance URL (web):

```typescript
const url = yield* api.services.SettingsService.getInstanceUrl();
```

### getAccessToken

Get access token (web):

```typescript
const token = yield* api.services.SettingsService.getAccessToken();
```

### getApiVersion

Get API version (web):

```typescript
const version = yield* api.services.SettingsService.getApiVersion();
```

### setInstanceUrl

Set instance URL (web):

```typescript
yield* api.services.SettingsService.setInstanceUrl(url);
```

### setAccessToken

Set access token (web):

```typescript
yield* api.services.SettingsService.setAccessToken(token);
```

### setApiVersion

Set API version (web):

```typescript
yield* api.services.SettingsService.setApiVersion(version);
```

### getRetrieveOnLoad

Get retrieve on load setting:

```typescript
const value = yield* api.services.SettingsService.getRetrieveOnLoad();
```

## Errors

- `SettingsError` - Setting read/write failed

## Examples

From `salesforcedx-vscode-services`:

```typescript
const instanceUrl = yield* api.services.SettingsService.getInstanceUrl();
const accessToken = yield* api.services.SettingsService.getAccessToken();
const apiVersion = yield* api.services.SettingsService.getApiVersion();
```

## Notes

- Web methods (instanceUrl, accessToken, apiVersion) use `CODE_BUILDER_WEB_SECTION`
- `setValue` updates globally (`ConfigurationTarget.Global`)
- Empty strings = missing for web settings
- Default API version: '64.0'
