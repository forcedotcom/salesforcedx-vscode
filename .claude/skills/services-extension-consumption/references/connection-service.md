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

### withDefaultOrg

Run effect with default org wrapped in `ServicesOrg` facade:

```typescript
const result = yield* api.services.ConnectionService.withDefaultOrg(org => {
  // org: ServicesOrg wrapping Connection
  return org.getUsername();
});
```

Resource pattern: org connection cleaned up after effect completes. Acquires connection, executes callback (sync or async), releases on exit.

**ServicesOrg methods** (all async):
- `query<T>(soql, opts?)` → `OwnedQueryResult<T>` — SOQL query; `opts.tooling` routes to tooling API
- `singleRecordQuery<T>(soql, opts?)` → `T` — single-record query
- `create(sobjectType, record, opts?)` → `OwnedSaveResult` — DML insert
- `update(sobjectType, record, opts?)` → `OwnedSaveResult` — DML update
- `delete(sobjectType, id, opts?)` → `OwnedSaveResult` — DML delete
- `request<R>(req)` → `R` — raw HTTP request
- `identity()` → `OwnedIdentityInfo` — authenticated user metadata

**Error handling**: DML operations return `OwnedSaveResult` with `errors[]` array. Each error has `statusCode` (reads both jsforce `statusCode` + `errorCode` fields, with `errorCode` as fallback; defaults to `'UNKNOWN'`), `message`, optional `fields[]`.

### getConnectionData

Extract connection metadata without creating connection:

```typescript
const data = yield* api.services.ConnectionService.getConnectionData();
// { id, type, username, orgId, instanceUrl, apiVersion, accessToken? }
```

Returns `ConnectionData` from `@salesforce/core` — useful for auth state checks without full connection overhead.

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
