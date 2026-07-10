# Code Builder e2e runs the desktop build over a browser via runtime extension-swap

Code Builder (Agentforce Vibes) serves a Salesforce-customized code-server with a
**Node extension host** behind a browser UI. It therefore runs the **desktop**
extension build (the `node`/`main` entry with full Node APIs, `child_process`, CLI
shell-outs), not the browser/web-worker build. Its e2e suite runs the existing
**desktop** Playwright specs, driven by a browser client pointed at the container URL —
not `@vscode/test-web`, not Electron.

Extensions under test are swapped into the running container **at runtime**: pull the
published `workspace-manager/codebuilder:latest` image, `docker exec` to remove both the
in-scope `/base/extension-overrides/salesforce.<ext>-*` dirs and their runtime symlinks in
`/home/codebuilder/.local/share/code-server/extensions/`, then unpack the VSIX (downloaded from an upstream
Build All run) into a fresh override dir. The runtime symlinks must be cleared because
`start.sh` re-links overrides into the runtime dir only when the override is strictly-newer
semver than what's already linked; without clearing them, a same-or-lower VSIX would never
re-link on restart and the host would load nothing. Then `docker restart` boots the host
holding the new versions. A filesystem version gate asserts each in-scope extension's installed version equals
the shipped version from that artifact (and exactly one dir per ID) before any spec runs.

## Considered Options

- **Run against `@vscode/test-web`** — rejected: web mode loads the **browser** extension
  build in a web-worker host. CB runs the **Node** host, so `@vscode/test-web` exercises a
  different runtime and a different extension bundle — it cannot catch CB-specific breakage.
- **Test against live Code Builder in an AWS MDE** — rejected for v1: the MDE is a thin
  auth/networking wrapper around the same code-server; near-zero bearing on extension
  functionality, and it forces CB-team involvement. The image alone is sufficient fidelity.
- **Build the image from source per run** — rejected: needs the `GITHUB_APP_ACCESS_TOKEN`
  build secret (private code-server `.deb` + private extensions), is slow, and a local build
  can drift from what ships. Pulling the published image tests the real distro.
- **Rebuild extensions in the workflow** — rejected: CI downloads the exact VSIX artifact from
  an upstream Build All run (the same bytes about to ship), matching the desktop e2e leaves.
  Rebuilding tests *a* build, not *the* release artifact, and adds latency.
- **Bake prerelease vsix at image build time** (CB's `INSTALL_PRERELEASE` path) — rejected:
  requires a `code-builder-images` change or build-secret plumbing. Runtime swap + `docker restart`
  reaches the same clean-boot state with zero CB-repo involvement.
- **Reload-window instead of container restart** — rejected: `Developer: Reload Window`
  races (must wait for re-scan) and does not re-run `before_start.sh`, so org auth would not
  refresh. `docker restart` swaps extensions AND re-runs `sfdx-org-auth.sh` in one lever.
- **Assert versions via "Show Running Extensions" / `getExtension().packageJSON`** —
  rejected: activation is lazy, so an un-activated in-scope extension is silently absent and
  a mismatch reads as pass. The on-disk `package.json` reflects what is *installed*,
  activation-independent.

## Consequences

- The container suite runs the **full** installed extension set (no per-package isolation) —
  higher fidelity than desktop CI's `--disable-extensions`, but cross-extension interference
  is in scope. Specs are a curated set that behaves under a full install, not a 1:1 port.
- Page objects/helpers in `playwright-vscode-ext` take a plain Playwright `Page`; the
  container fixture reuses them unchanged. Keep it that way — Electron/`_electron` coupling
  in a helper would break the container path.
- The version gate is the safety net for runtime swap: if CB's directory layout or extension
  IDs change, the gate fails loud rather than testing stale code. Revisit build-time baking
  (a CB PR) only if runtime swap proves flaky.
- Pulling `:latest` (rolling) means a CB image change can shift the baseline; accepted as the
  honest "what's live now" signal over a pinned tag.
- Running the container outside an MDE generates expected console noise from CB environment
  artifacts: the image writes an env-ready marker to `/projects` (unmounted in `docker run`),
  and bundled Agentforce MCP servers fail to reach their backends. These are suppressed in
  `nonCriticalErrorPatterns` and do not indicate test failure or extension issues.
