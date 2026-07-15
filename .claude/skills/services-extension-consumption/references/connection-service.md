# ConnectionService

Salesforce org connections. Accessor pattern: call methods directly.

## Methods

### getConnection

Get target org connection:

```typescript
const connection = yield* api.services.ConnectionService.getConnection();
```

Optional `username?` (username or alias) — connect to a specific org instead of the configured default:

```typescript
const connection = yield* api.services.ConnectionService.getConnection('user@example.com');
```

Given → alias-resolve it, skip the config `target-org` lookup, and do NOT mutate the default-org ref
(`maybeUpdateDefaultOrgRef`). Omitted → resolve the configured default and update the ref. Web ignores the param.

Returns `Connection` from `@salesforce/core`.

Auto-validates access-token (session-ID) flow connections via `identity()` before returning. On failure: shows a reauth modal, and (if accepted) dispatches `sf.org.login.web`, then fails with `AccessTokenExpiredError`. No-op for refreshable (web/JWT) flows. Consumers get the reauth modal automatically — no need to re-implement token validation.

### validateAccessTokenOrPromptReauth

Runs the access-token validation above against a given `Connection` (called internally by `getConnection`):

```typescript
yield* api.services.ConnectionService.validateAccessTokenOrPromptReauth(connection);
```

### invalidateCachedConnections

After auth files or tokens change on disk, drop cached JSForce connections so the next `getConnection()` reloads `AuthInfo`:

```typescript
yield* api.services.ConnectionService.invalidateCachedConnections();
```

## Errors

- `NoTargetOrgConfiguredError` - No target org
- `FailedToResolveUsernameError` - Can't resolve username/alias
- `FailedToCreateConnectionError` - Connection creation failed
- `AccessTokenExpiredError` - Session-ID token expired; reauth modal shown, `sf.org.login.web` dispatched

## Examples

From `salesforcedx-vscode-metadata`:

```typescript
const connection = yield* api.services.ConnectionService.getConnection();
```

## Notes

- Web: uses settings (instanceUrl, accessToken, apiVersion)
- Desktop: resolves username/alias from config
- Cached by username/instanceUrl; cache cleared when SF config files change (watcher) and after org extension refreshes config/state post-auth so `getConnection` reloads `AuthInfo` (avoids stale sessions after token refresh)
- Auto-updates default org ref (`maybeUpdateDefaultOrgRef`) — skipped when a `username` is passed
- Ref username: User SOQL when possible; empty → `conn.getUsername()` / AuthInfo `username`
- Requires `ConfigService`, `SettingsService`
