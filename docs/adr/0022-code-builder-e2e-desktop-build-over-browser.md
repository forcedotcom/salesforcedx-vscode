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
- **Unconditionally wipe all `salesforce.*` extensions, then install** (instead of clearing
  in-scope dirs to win the precedence relink) — candidate, stronger reliability, not yet
  adopted. The current swap rides two contracts the `code-builder-images` team owns: `start.sh`
  re-links an override only when it is strictly-newer semver, and the workaround of clearing
  the baked override + runtime symlink to make ours count as "new." Both break if that linking
  rule changes or if an unreleased build carries an equal-or-lower version than what is baked
  (a real case once pre-release builds are not version-bumped). Deleting every `salesforce.*`
  dir from the runtime and override locations unconditionally — then installing ours as the only
  copy present — removes the dependency on semver precedence entirely: with nothing to compare
  against, ours is the only thing that can load. Tradeoff: it tests a clean install rather than an
  upgrade-over-existing, and it must wipe by publisher glob rather than a hardcoded ID list so a
  baked extension under an unlisted ID cannot survive. Tracked in the PR; adopt if the precedence
  race proves fragile or once equal-version pre-release builds land.

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
- The gate compares installed semver against the artifact's semver, not bytes. When the swapped
  build shares a version with the baked one — an unreleased build not yet version-bumped — a
  swap that silently no-ops would still pass the gate, since `67.4.0 == 67.4.0` holds against the
  leftover baked copy. Closing this needs a content check (hash the VSIX bytes and assert the
  installed dir matches) or a build stamp (a git SHA / build timestamp baked into the VSIX at
  package time, gated on directly and surfaced in the provenance banner). The unconditional-wipe
  option above is complementary: wipe proves *only ours can load*; a content/stamp check proves
  *the bytes are the ones intended*. Official pre-release versions from `code-builder-images`
  would satisfy the current semver gate, but by fixing the version contract rather than removing
  the dependency on it — the wipe + content check hold regardless of how versioning evolves.
- Pulling `:latest` (rolling) means a CB image change can shift the baseline; accepted as the
  honest "what's live now" signal over a pinned tag.
- Running the container outside an MDE generates expected console noise from CB environment
  artifacts: the image writes an env-ready marker to `/projects` (unmounted in `docker run`),
  and bundled Agentforce MCP servers fail to reach their backends. These are suppressed in
  `nonCriticalErrorPatterns` and do not indicate test failure or extension issues.

## Workspace seeding

What the workbench opens is decided by the image's own bootstrap, not by this repo. On the
container's **first** start, `before_start.sh` runs `sfdx-setup.sh` (once — it is gated behind a
`~/.codebuilder` marker file and skipped on every later start, including our swap `docker restart`),
which:

- with `SFDX_COBU_PROJECTNAME` + `SFDX_COBU_TEMPLATE` set, runs `sfdx project generate` into the
  home dir, or
- with `SFDX_COBU_GITHUB_PROJECT_URL` set instead, `git clone`s that repo,

then writes `~/.local/share/code-server/coder.json` with `{"query":{"folder":"<project path>"}}` so
code-server opens that folder. The workflow currently sets `SFDX_COBU_PROJECTNAME=e2e-project` /
`SFDX_COBU_TEMPLATE=standard`, so the container opens a **bare generated `standard` project** — empty
`force-app`, no metadata. `SFDX_COBU_GITHUB_PROJECT_URL` is a dormant path (nothing sends it; the
seeding block is untouched since 2023) — do not build on it.

Specs that need real metadata to drive against (open a class, run a test, deploy) therefore have
nothing seeded today. Two ways to get there, mirroring the desktop side:

- **Create metadata mid-spec via extension commands** — reuse `createApexClass` /
  `createAndDeployApexTestClass` from `playwright-vscode-ext` against the bare project. No image
  involvement, but slower and it exercises the create-command path rather than a fixed starting
  state.
- **Volume-mount a fixture project (candidate, not yet built)** — keep a version-controlled SFDX
  project under `test/playwright/fixtures/` (with `sfdx-project.json` and prepopulated `force-app`
  metadata), `docker run -v <fixture>:<path-in-container>`, then point code-server at it by writing
  `coder.json` ourselves via `docker exec` (the same lever already used to disable workspace trust
  and swap extensions). Deterministic and in-repo. Deliberately does **not** reuse the `SFDX_COBU_*`
  env path or the GitHub-clone branch: those run only on first boot behind the `.codebuilder` gate
  and live in image code the CB team owns and can change, whereas a mount is applied by Docker at
  `run` time, survives restart, and depends on nothing inside the image except the `coder.json`
  folder query. Same decoupling principle as the extension-swap options above — do not rely on
  contracts the `code-builder-images` team can move under us. Load-bearing detail for whoever
  implements this: changing the opened folder means the disable-workspace-trust step and the
  workbench-ready wait must target the new path, or extensions open untrusted and never activate.
