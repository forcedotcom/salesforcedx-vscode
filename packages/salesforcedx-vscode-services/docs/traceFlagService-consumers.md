# TraceFlagService consumer audit — W-23839380

Audited before implementation, against local commit `a4037fc56cfd47d9b324274ab79047ee83f0cb1f`.

## In-repo contract

- `src/index.ts` exposes the existing `TraceFlagService` tag through `api.services`; `src/servicesLayers.ts` builds it once in the shared context. Keep both unchanged.
- Apex Log commands consume debug-level CRUD, trace-flag lookup/ensure/delete/change-level, string IDs, and `DebugLevelCreateError`.
- Apex Log's content provider, CodeLens, and status bar consume camelCase items with `Date` values and the shared `traceFlagsChanged` PubSub.
- `salesforcedx-vscode-apex-log/src/traceFlagCleanupScheduler.ts` consumes `cleanupExpired`.
- `salesforcedx-vscode-apex-replay-debugger/src/services/ensureTraceFlags.ts` consumes `getUserId` and `ensureTraceFlag`.
- User, ApexClass, and ApexTrigger names are resolved by Services, including org-specific cache invalidation. Entity IDs must not be restricted to User IDs when delegating.

## Pinned external sources

| Repository / ref | Commit | Inspected files / result |
| --- | --- | --- |
| `forcedotcom/salesforcedx-vscode-einstein-gpt`, `main` | `1c13d047f1f51ff360882b5b83257169ff77c02c` | `packages/extension/src/services/auth/org-service.ts`: ConnectionService, TargetOrgRef, prebuiltServicesDependencies; no TraceFlagService. `.github/workflows/release.yml` confirms main-based releases. |
| Same repository, `afv-v3.0-iac` | `49b45c5f250070bb051d99b4bbb63a398cf03786` | `src/services/CoreExtensionService.ts`: core API, not TraceFlagService. Main's `.github/workflows/iac-release.yml` explicitly builds this non-default branch. |
| `forcedotcom/vibes-preview`, `HEAD` | `41946d2e58810e564b877e516142abc5bd0ed2fd` | `src/extension/services/observability/services-api.ts`, `src/extension/services/salesforce/org-settings.service.ts`: ConnectionService, TargetOrgRef, prebuiltServicesDependencies; no TraceFlagService. |
| `forcedotcom/apex-language-support`, `HEAD` | `031ea17e9a49b5582777babea3d1afe8ec8fdfc4` | `packages/apex-lsp-vscode-extension/src/services/salesforce-services-extension.ts`: typed services-extension lookup; no TraceFlagService. |

GitHub code searches for `TraceFlagService` in `org:forcedotcom` returned only this repository and its CI-testing copy; `org:salesforcecli` returned zero. Searches for `salesforcedx-vscode-services` also identified the external files above. Search indexes default branches only; the IAC branch was inspected directly. These results bound the audit, not a claim about every private or non-default branch.

## Compatibility boundary

Keep Services' tag/context, public method signatures, item shapes, error tags, cache ownership, and PubSub lifecycle. Apex-node accepts only UserId, ApexClassId, or ApexTriggerId for trace-flag entity operations and names its lookup `getTraceFlagForEntity`; Services keeps its existing public `getTraceFlagForUser` method for compatibility. No changes to ConnectionService, TargetOrgRef, or prebuiltServicesDependencies.
