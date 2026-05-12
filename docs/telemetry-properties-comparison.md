# Telemetry Properties Comparison: vscode-utils vs services

Comparison of properties sent to Application Insights from the two telemetry implementations.

## Common Properties (set once, sent with every event)

| Property Key | vscode-utils | services | Notes |
|---|---|---|---|
| `common.os` | `os.platform()` | **NOT SET** | **MISMATCH** - missing in services |
| `common.platformversion` | `os.release()` regex-trimmed | `os.release()` regex-trimmed (Desktop only) | Same derivation; services skips in Web |
| `common.cpus` | `os.cpus()[0]` model/count/speed | `os.cpus()[0]` model/count/speed (Desktop only) | Same derivation; services skips in Web |
| `common.systemmemory` | `os.totalmem()` in GB | `os.totalmem()` in GB (Desktop only) | **MISMATCH** - services has operator precedence bug (see below) |
| `common.extname` | Constructor param `extensionId` | Resource attribute `extension.name` | Same value, different source |
| `common.extversion` | Constructor param `extensionVersion` | Resource attribute `extension.version` | Same value, different source |
| `common.vscodemachineid` | `env.machineId` | `env.machineId` | Same |
| `common.vscodesessionid` | `env.sessionId` | `env.sessionId` | Same |
| `common.vscodeversion` | `vscode.version` | `vscode.version` | Same |
| `common.vscodeuikind` | `UIKind[env.uiKind]` | `UIKind[env.uiKind]` | Same |
| `common.isInternal` | **NOT SET** | `'true'`/`'false'` based on hostname (Desktop only) | **MISMATCH** - missing in vscode-utils |

## Internal-Only Properties

| Property Key | vscode-utils | services | Notes |
|---|---|---|---|
| `sfInternal.hostname` | `os.hostname()` (when `isInternalHost()`) | **NOT SET** | **MISMATCH** - only in vscode-utils |
| `sfInternal.username` | `os.userInfo().username` (when `isInternalHost()`) | **NOT SET** | **MISMATCH** - only in vscode-utils |

## Per-Event Properties (added to each event/span)

| Property Key | vscode-utils | services | Notes |
|---|---|---|---|
| `orgId` | `WorkspaceContextUtil.orgId` | `DefaultOrgRef.orgId` | Same concept, different source object |
| `orgShape` | `WorkspaceContextUtil.orgShape` ('Scratch'/'Sandbox'/'Production'/'Undefined') | **NOT SET** | **MISMATCH** - services uses `isScratch`/`isSandbox` booleans instead |
| `isScratch` | **NOT SET** | `DefaultOrgRef.isScratch` as `'true'`/`'false'` | **MISMATCH** - vscode-utils uses `orgShape` enum |
| `isSandbox` | **NOT SET** | `DefaultOrgRef.isSandbox` as `'true'`/`'false'` | **MISMATCH** - vscode-utils uses `orgShape` enum |
| `tracksSource` | **NOT SET** | `DefaultOrgRef.tracksSource` as `'true'`/`'false'` | **MISMATCH** - missing in vscode-utils |
| `devHubId` | `WorkspaceContextUtil.devHubId` | — | Key name differs (see below) |
| `devHubOrgId` | — | `DefaultOrgRef.devHubOrgId` | **MISMATCH** - different key name from vscode-utils `devHubId` |
| `userId` | Constructor param (CLI telemetry ID or random hash) | `DefaultOrgRef.cliId` | Same value, different wiring |
| `webUserId` | Constructor param + per-event override | `DefaultOrgRef.webUserId` | Same value |
| `telemetryTag` | VS Code config `salesforcedx-vscode-core.telemetry-tag` | VS Code config `salesforcedx-vscode-core.telemetry-tag` | Same |

## Where Properties Are Derived

### vscode-utils (`packages/salesforcedx-utils-vscode`)

| Source | Properties |
|---|---|
| `os` module (Node.js) | `common.os`, `common.platformversion`, `common.cpus`, `common.systemmemory`, `sfInternal.hostname`, `sfInternal.username` |
| `vscode` API (`env`, `version`) | `common.vscodemachineid`, `common.vscodesessionid`, `common.vscodeversion`, `common.vscodeuikind` |
| Constructor params | `common.extname`, `common.extversion`, `userId`, `webUserId` |
| `WorkspaceContextUtil` singleton | `orgId`, `orgShape`, `devHubId` |
| VS Code workspace config | `telemetryTag` |

Key files:
- [telemetryUtils.ts](packages/salesforcedx-utils-vscode/src/telemetry/reporters/telemetryUtils.ts) - common property derivation
- [appInsights.ts](packages/salesforcedx-utils-vscode/src/telemetry/reporters/appInsights.ts) - reporter + per-event properties
- [loggingProperties.ts](packages/salesforcedx-utils-vscode/src/telemetry/reporters/loggingProperties.ts) - type definitions

### services (`packages/salesforcedx-vscode-services`)

| Source | Properties |
|---|---|
| `os` module (Node.js, Desktop only) | `common.platformversion`, `common.cpus`, `common.systemmemory` |
| `vscode` API (`env`, `version`) | `common.vscodemachineid`, `common.vscodesessionid`, `common.vscodeversion`, `common.vscodeuikind` |
| OTel Resource attributes | `common.extname`, `common.extversion` |
| `DefaultOrgRef` (Effect SubscriptionRef) | `orgId`, `devHubOrgId`, `isSandbox`, `isScratch`, `tracksSource`, `userId` (cliId), `webUserId` |
| `os.hostname()` check (cached) | `common.isInternal` |
| VS Code workspace config | `telemetryTag` |

Key files:
- [spanTransformProcessor.ts](packages/salesforcedx-vscode-services/src/observability/spanTransformProcessor.ts) - all property derivation + attachment to spans
- [defaultOrgInfo.ts](packages/salesforcedx-vscode-services/src/core/schemas/defaultOrgInfo.ts) - org context schema

## Summary of Mismatches

| # | Mismatch | Detail |
|---|---|---|
| 1 | `common.os` missing in services | Services spans have no OS platform identifier |
| 2 | `common.isInternal` missing in vscode-utils | vscode-utils uses `sfInternal.*` properties (only set for internal); services uses a boolean attribute on every event |
| 3 | `sfInternal.hostname`/`sfInternal.username` missing in services | Services doesn't identify specific internal users |
| 4 | `orgShape` (enum) vs `isScratch`/`isSandbox` (booleans) | Different representation of the same concept; queries must handle both |
| 5 | `devHubId` vs `devHubOrgId` key name | Same value under different attribute names |
| 6 | `tracksSource` missing in vscode-utils | Only services reports source tracking capability |
| 7 | `common.systemmemory` operator precedence bug in services | Line 83 of spanTransformProcessor.ts: `(os?.totalmem?.() ?? 0 / (1024*1024*1024)).toFixed(2)` — the division applies to the fallback `0`, not to `totalmem()`. Correct only when `totalmem()` succeeds. |
| 8 | Desktop-only gating differs | Services explicitly gates OS properties behind `uiKind === 'Desktop'`; vscode-utils always attempts them |
