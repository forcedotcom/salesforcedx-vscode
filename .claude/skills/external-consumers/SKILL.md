---
name: external-consumers
description: Known external consumers of APIs from this monorepo's extensions. Use when changing public API surfaces (activate return types, exported types, services sub-objects), evaluating breaking changes, removing exports, or checking if anything uses a given API member.
---

# External Consumers

Other repos consume APIs from this monorepo's extensions. Some are private.

- Exported extension APIs = **public contracts**
- Remove/change field, method, behavior = breaking
- Add field = non-breaking
- **Cannot grep this monorepo alone** — must check external repos
- Consumers version-gate (`semver.satisfies`) — major bump alone insufficient

## On-demand validation via `gh` CLI

```bash
# search specific repo
gh api -X GET "search/code?q=SYMBOL+repo:forcedotcom/REPO&per_page=20" \
  --jq '.items[] | "\(.path)"'

# read file from private repo
gh api repos/forcedotcom/REPO/contents/PATH --jq '.content' | base64 -d

# search all forcedotcom repos
gh api -X GET "search/code?q=SYMBOL+org:forcedotcom&per_page=30" \
  --jq '.items[] | "\(.repository.name): \(.path)"'

# search salesforcecli org too
gh api -X GET "search/code?q=SYMBOL+org:salesforcecli&per_page=30" \
  --jq '.items[] | "\(.repository.name): \(.path)"'
```

Rate limit ~30 req/min on search API. Use contents API for targeted reads.

## Direct core API consumers (`SalesforceVSCodeCoreApi`)

Via `vscode.extensions.getExtension('salesforce.salesforcedx-vscode-core').exports`:

| Repo | Visibility | Consumed |
|------|-----------|----------|
| [vscode-agents](https://github.com/forcedotcom/vscode-agents) | Public | `services.{ChannelService,TelemetryService,WorkspaceContext}` |
| [metadata-visualizer](https://github.com/forcedotcom/salesforce-metadata-visualizer) | **Private** | `services.TelemetryService` |
| [code-analyzer](https://github.com/forcedotcom/sfdx-code-analyzer-vscode) | Public | `services.WorkspaceContext` (direct), telemetry via service-provider |

## `@salesforce/vscode-service-provider` consumers

[Repo](https://github.com/forcedotcom/salesforcedx-vscode-service-provider) (public) — abstraction bridging to core services. Still depends on core being active.

| Repo | Service |
|------|---------|
| code-analyzer | `ServiceType.Telemetry` |
| einstein-gpt | `ServiceType.Telemetry` |

## extensionDependency-only (no API consumption)

| Repo | Visibility | Notes |
|------|-----------|-------|
| [ui-preview](https://github.com/forcedotcom/salesforcedx-vscode-ui-preview) | **Private** | Activation ordering only. Uses bundled `WorkspaceContextUtil` from utils-vscode. |

## No current core dependency

| Repo | Notes |
|------|-------|
| [einstein-gpt](https://github.com/forcedotcom/salesforcedx-vscode-einstein-gpt) | **Private**. Now the Agentforce Vibes monorepo (`packages/`, pnpm). extensionDependency = `salesforcedx-vscode-services` only; dropped core. Direct core API (`services.{ChannelService,WorkspaceContext,SalesforceProjectConfig,CommandEventDispatcher}`, `getOrgShape`) all dead. Still uses `@salesforce/vscode-service-provider` `ServiceType.Telemetry` (see below). |
| [slds](https://github.com/forcedotcom/salesforcedx-vscode-slds) | No extensionDep, no getExtension. In same extension pack. |
| [apex-language-support](https://github.com/forcedotcom/apex-language-support) | Experimental. String refs only in tests/comments. |
| apex-oas (in-repo) | extensionDependency = `salesforcedx-vscode-apex` + `salesforcedx-vscode-services`; no core dep. Reads project/registry/fs via services-extension `api.services.*`. Only cross-extension `.exports` use is apex's `.languageClientManager`. |

## In-repo consumers

**IMPORTANT**: In-repo packages access core API via TWO patterns:
1. Wrapper functions in `coreExtensionUtils.ts` (easy to grep)
2. **Direct `.exports.MEMBER()` calls** scattered across source files (easy to miss)

Always grep for `\.exports\.\w+` across the full monorepo, not just `coreExtensionUtils.ts`.

| Package | Files | Members accessed |
|---------|-------|------------------|
| apex-debugger | `coreExtensionUtils.ts`, `index.ts` | `.telemetryService` |
| apex-replay-debugger | `index.ts`, `checkpointService.ts`, `quickLaunch.ts`, `debugConfigurationProvider.ts` | `.services.WorkspaceContext`, `.getUserId` |
| utils-vscode | `workspaceContextUtil.ts`, `telemetryUtils.ts` | `.channelService`, `.getSharedTelemetryUserId` (phantom — not on API type) |

## Keeping current

Verified 2026-07-02. Before asserting "nobody uses X":
1. Grep monorepo for `\.exports\.MEMBER` — catches direct access outside wrapper files
2. Search `org:forcedotcom` and `org:salesforcecli` via `gh api`
3. Read private repos via contents API
4. Check `extensionPack` in `salesforcedx-vscode` and `salesforcedx-vscode-expanded` for new extensions
