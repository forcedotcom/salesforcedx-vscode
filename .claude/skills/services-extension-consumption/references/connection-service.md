# ConnectionService

Salesforce org connections. Accessor pattern: call methods directly.

## Methods

### getConnection

Get target org connection:

```typescript
const connection = yield* api.services.ConnectionService.getConnection();
```

Returns `Connection` from `@salesforce/core`.

## Errors

- `NoTargetOrgConfiguredError` - No target org
- `FailedToResolveUsernameError` - Can't resolve username/alias
- `FailedToCreateConnectionError` - Connection creation failed

## Examples

From `salesforcedx-vscode-metadata`:

```typescript
const connection = yield* api.services.ConnectionService.getConnection();
```

## Notes

- Web: uses settings (instanceUrl, accessToken, apiVersion)
- Desktop: resolves username/alias from config
- Cached by username/instanceUrl
- Auto-updates default org ref (`maybeUpdateDefaultOrgRef`)
- Ref username: User SOQL when possible; empty → `conn.getUsername()` / AuthInfo `username`
- Requires `ConfigService`, `SettingsService`
