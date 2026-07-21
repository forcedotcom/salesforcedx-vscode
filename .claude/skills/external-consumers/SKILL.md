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

### ⚠️ Code search only indexes the DEFAULT branch

`search/code` never sees non-default branches ([GitHub docs](https://docs.github.com/en/search-github/github-code-search/about-github-code-search)). A repo whose shipping extension lives on a release branch (see einstein-gpt below) returns **zero hits** even when it heavily consumes core. Zero search hits ≠ no consumer. Confirm a repo's shipping branch (check `.github/workflows/*release*.yml` for the `ref:` it checks out), then walk that branch's tree + read files directly:

```bash
# find the ref the release workflow builds from
gh api repos/forcedotcom/REPO/contents/.github/workflows --jq '.[].name'
gh api "repos/forcedotcom/REPO/contents/.github/workflows/RELEASE.yml" --jq '.content' | base64 -d | grep -n 'ref:'

# list a non-default branch's files, then read the ones you care about
gh api "repos/forcedotcom/REPO/git/trees/BRANCH?recursive=1" --jq '.tree[].path'
gh api "repos/forcedotcom/REPO/contents/PATH?ref=BRANCH" --jq '.content' | base64 -d
```

## Direct core API consumers (`SalesforceVSCodeCoreApi`)

Via `vscode.extensions.getExtension('salesforce.salesforcedx-vscode-core').exports`:

| Repo | Visibility | Consumed |
|------|-----------|----------|
| [vscode-agents](https://github.com/forcedotcom/vscode-agents) | Public | `services.{ChannelService,TelemetryService,WorkspaceContext}` |
| [metadata-visualizer](https://github.com/forcedotcom/salesforce-metadata-visualizer) | **Private** | `services.TelemetryService` |
| [code-analyzer](https://github.com/forcedotcom/sfdx-code-analyzer-vscode) | Public | `services.WorkspaceContext` (direct), telemetry via service-provider |
| [einstein-gpt](https://github.com/forcedotcom/salesforcedx-vscode-einstein-gpt) (Agentforce Vibes Autocomplete — see note) | **Private** | `services.{ChannelService,WorkspaceContext,SalesforceProjectConfig,CommandEventDispatcher}`, `workspaceContextUtils.getOrgShape` |

> **einstein-gpt ships from a non-default branch.** The published extension `salesforce.agentforce-vibes-autocomplete` (VS Marketplace, ~27k installs) is built from branch **`afv-v3.0-iac`**, not `main` (its `.github/workflows/iac-release.yml` checks out `ref: afv-v3.0-iac`; `main` is now an unrelated `packages/` monorepo). On `afv-v3.0-iac` the extension **hard-depends on core**: `extensionDependencies` includes `salesforce.salesforcedx-vscode-core`, `MINIMUM_REQUIRED_VERSION_CORE_EXTENSION = '60.13.0'`, and `src/services/CoreExtensionService.ts` **throws** `CommandEventDispatcher not found` at activation if core omits it. **Do not remove `CommandEventDispatcher` / `onRefreshSObjectsCommandCompletion` (`sf.internal.sobjectrefresh.complete`) from core's API** — it is a live contract. Because code search skips non-default branches, `main`-only sweeps show zero hits and falsely read as "core dep dropped"; always inspect `afv-v3.0-iac` directly.

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

Verified 2026-07-21. Before asserting "nobody uses X":
1. Grep monorepo for `\.exports\.MEMBER` — catches direct access outside wrapper files
2. Search `org:forcedotcom` and `org:salesforcecli` via `gh api`
3. Read private repos via contents API
4. **For repos that ship from a non-default branch (e.g. einstein-gpt → `afv-v3.0-iac`), inspect that branch directly — code search misses it** (see the ⚠️ above)
5. Check `extensionPack` in `salesforcedx-vscode` and `salesforcedx-vscode-expanded` for new extensions
