---
name: web-extension-authoring
description: Author/web-enable a VS Code extension feature (VS Code for Web / Code Builder). Use when adding a browser field, splitting a dual-target web bundle, gating on ESBUILD_PLATFORM, using memfs/workspace.fs, or making a feature run on web.
---

# Web extension authoring

Scope: web-enabling/authoring an extension feature (browser host, no Node, no CLI). Router only — follow links.

## Not on web → alternative

| Not on web | Use |
| --- | --- |
| `child_process` / `terminalService` | in-process libs ([ADR 0009](../../../docs/adr/0009-reduce-cli-deps-web-no-cli.md), [ADR 0010](../../../docs/adr/0010-web-support-libs-in-process.md)) |
| native `fs` | `FsService` / memfs provider ([fs-service](../services-extension-consumption/references/fs-service.md)) |
| the CLI | services API (Connection from injected auth, [ADR 0008](../../../docs/adr/0008-services-sole-host-heavy-deps.md)) |
| `workspace.findFiles` glob | `FsService.readDirectoryWithTypes` traverse / SDR ComponentSetService |
| `node:path` | vscode-uri `Utils` ([paths](../paths/SKILL.md)) |
| appInsights v2 | otel spans ([ADR 0012](../../../docs/adr/0012-spans-only-observability.md)) |

## Bundle split

- Two-bundle tree-shake on `ESBUILD_PLATFORM`: [ADR 0013](../../../docs/adr/0013-dual-target-bundle-time-split.md), [Build.md](../../../docs/Build.md)
- Use inline literal `process.env.ESBUILD_PLATFORM` at the branch — never assign to const/prop (breaks dead-branch elimination)

## package.json

- `browser`=`dist/web/index.js` (web host entry); `onFileSystem:memfs` activation (`workspaceContains` doesn't fire for memfs)
- [Build.md](../../../docs/Build.md), [packageJson](../packageJson/SKILL.md)

## Paths

- vscode-uri `Utils`, memfs scheme — [paths](../paths/SKILL.md)

## Per-package opt-out

- Deliberate desktop-only: add `docs/adr/*deliberately-not-web.md` ([org 0002 example](../../../packages/salesforcedx-vscode-org/docs/adr/0002-deliberately-not-web.md))

## Testing

- [playwright-e2e](../playwright-e2e/SKILL.md), `test:web`
- Web Playwright runs in a `memfs:/` workspace (scheme `memfs`), NOT a `vscode-test-web` mount
- `FsProvider.writeFile` hits the same `@salesforce/core/fs` polyfill `SfProject.resolve` reads — editor writes reach the SfProject fs
- `.headless.spec.ts` runs web+desktop; reserve Node fs/path for `.desktop.spec.ts`
