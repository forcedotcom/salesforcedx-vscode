---
name: core-extension-api
description: Public API exported by salesforcedx-vscode-core activate(). Use when modifying SalesforceVSCodeCoreApi, the api object in activate(), exports from core index.ts, services sub-object, or evaluating whether a change to core is breaking. Also use when someone asks "does anything use X" for a core export.
---

# Core Extension Public API

`packages/salesforcedx-vscode-core/src/index.ts` — `activate()` returns `SalesforceVSCodeCoreApi`.

Consumers access via:
```typescript
const ext = vscode.extensions.getExtension<SalesforceVSCodeCoreApi>(
  'salesforce.salesforcedx-vscode-core'
);
const api = ext.exports;
```

Also consumed indirectly via [`@salesforce/vscode-service-provider`](https://github.com/forcedotcom/salesforcedx-vscode-service-provider).

## Public API — external consumers depend on this

See [external-consumers](../external-consumers/SKILL.md) for full list and search commands.

**Breaking** (check consumers first):
- Remove field from `SalesforceVSCodeCoreApi`
- Change field type
- Change behavior (even same signature)
- Change static methods on `services.*` classes (`.getInstance()`)
- Rename/restructure `services` sub-object

**Non-breaking**: add new fields.

## API surface

### Top-level (instances/functions)

```
channelService, getUserId, getAuthFields, isCLIInstalled,
SfCommandlet, SfCommandletExecutor, WorkspaceContext,
telemetryService, workspaceContextUtils, sharedAuthState
```

### `services` (class constructors with static methods)

```
RegistryAccess, ChannelService (.getInstance(name)),
SalesforceProjectConfig, TelemetryService (.getInstance(name)),
WorkspaceContext (.getInstance()), CommandEventDispatcher (.getInstance())
```

External consumers predominantly use `services.*`. The `.getInstance()` signatures are public contract.

### Overlap

Some capabilities at both levels (e.g. `telemetryService` instance top-level, `services.TelemetryService` class). Consumers may use either/both — check both when evaluating usage.

## Before changing

1. Read [external-consumers](../external-consumers/SKILL.md)
2. Grep monorepo: `\.exports\.MEMBER` — catches direct access outside wrapper files
3. Search org:
   ```bash
   gh api -X GET "search/code?q=SYMBOL+org:forcedotcom&per_page=30" \
     --jq '.items[] | "\(.repository.name): \(.path)"'
   # also search salesforcecli org
   gh api -X GET "search/code?q=SYMBOL+org:salesforcecli&per_page=30" \
     --jq '.items[] | "\(.repository.name): \(.path)"'
   # also search for exports.SYMBOL (direct access pattern)
   gh api -X GET "search/code?q=exports.SYMBOL+org:forcedotcom&per_page=30" \
     --jq '.items[] | "\(.repository.name): \(.path)"'
   ```
4. Read private repos: `gh api repos/forcedotcom/REPO/contents/PATH --jq '.content' | base64 -d`
5. Removing something unused in monorepo? Confirm unused externally too
6. Changing behavior? Check consumer version gates and minimum versions

## Consumer patterns

- `extensionDependencies: ["salesforce.salesforcedx-vscode-core"]`
- Version-check core (`semver.satisfies(version, '>=X.Y.Z')`)
- Define own minimal type (don't import `SalesforceVSCodeCoreApi` directly)
- Call `.getInstance(extensionName)` on services classes
- Graceful degradation if core missing/outdated
