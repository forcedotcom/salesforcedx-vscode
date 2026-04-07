# ConnectionService

Salesforce org connections. Accessor pattern: call methods directly.

## Methods

### getConnection

Get target org connection:

```typescript
const connection = yield* api.services.ConnectionService.getConnection();
```

Returns `Connection` from `@salesforce/core`.

### invalidateCachedConnections

After auth files or tokens change on disk, drop cached JSForce connections so the next `getConnection()` reloads `AuthInfo`:

```typescript
yield* api.services.ConnectionService.invalidateCachedConnections();
```

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
- Cached by username/instanceUrl; cache cleared when SF config files change (watcher) and after org extension refreshes config/state post-auth so `getConnection` reloads `AuthInfo` (avoids stale sessions after token refresh)
- Auto-updates default org ref (`maybeUpdateDefaultOrgRef`)
- Ref username: User SOQL when possible; empty → `conn.getUsername()` / AuthInfo `username`
- Requires `ConfigService`, `SettingsService`
