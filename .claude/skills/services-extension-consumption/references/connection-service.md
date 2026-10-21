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

Given → alias-resolve it, skip config `target-org`, do NOT mutate default-org ref. Omitted → resolve configured default, update ref. Web ignores param.

Returns `Connection` from `@salesforce/core`.

Auto-validates access-token (session-ID) flow connections via `identity()` before returning. On failure: shows a reauth modal, and (if accepted) dispatches `sf.org.login.web`, then fails with `AccessTokenExpiredError`. No-op for refreshable (web/JWT) flows. Consumers get the reauth modal automatically — no need to re-implement token validation.

### getAuthInfoFields

Get decoded auth fields for the configured org or an optional username/alias. Returns `AuthInfoFields`; failure to read or decode fields fails with `GetAuthFieldsError` (username included when known).

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
- `GetAuthFieldsError` - Can't read or decode auth fields
- `AccessTokenExpiredError` - Session-ID token expired; reauth modal shown, `sf.org.login.web` dispatched

## Examples

From `salesforcedx-vscode-metadata`:

```typescript
const connection = yield* api.services.ConnectionService.getConnection();
```

## Notes

- Web: uses settings (instanceUrl, accessToken, apiVersion)
- Desktop: resolves username/alias from config
- Connection cache: username/instanceUrl; cleared by `invalidateCachedConnections` when global `~/.sf/config.json` (`HostFileWatcher`) or project `.sf/config.json` (`FileChangePubSub`) change, and after org extension refreshes config/state post-auth so `getConnection` reloads `AuthInfo` (avoids stale sessions after token refresh)
- Auto-updates default org ref (`maybeUpdateDefaultOrgRef`) — skipped when `username` passed
- Treats ref stale if stored username ≠ connection auth username; re-queries username/userId/aliases/devHubOrgId instead of reusing them
- Writes atomically via `SubscriptionRef.modify` onto ref's value at write time; drops write if ref's orgId no longer matches connection's org (prevents out-of-order background forks overwriting current org)
- Ref username: User SOQL when possible; else `conn.getUsername()` / AuthInfo username
- Requires `ConfigService`, `SettingsService`
