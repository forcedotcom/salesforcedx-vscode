# Nightly Prerelease Builds

Automated nightly VS Code extension builds via `salesforcecli/github-workflows` shared CI.

## Usage

### Automatic

Daily 4 AM UTC: publishes all extensions as prereleases. New extensions auto-included via dynamic discovery.

### Manual Trigger

```bash
# Publish all (dynamically discovered)
gh workflow run nightly.yml

# Publish specific extensions only
gh workflow run nightly.yml -f extensions="salesforcedx-vscode-apex,salesforcedx-vscode-core"

# Dry-run (no publish)
gh workflow run nightly.yml -f dry-run=true
```

## Extension Discovery

`build-extension-list` job runs `scripts/list-vscode-extensions.js` — scans `packages/` for VS Code extensions:
- Filters: `engines.vscode`, `publisher`, `categories`; name starts `salesforcedx-vscode` (includes main bundle extension)
- Returns comma-separated list (sorted)
- Auto-included without workflow changes

For published releases, `scripts/parse-extension-names.js` dynamically extracts extension names from VSIX filenames in release artifacts. Supports both stable (`-1.2.3.vsix`) and prerelease (`-1.2.3-beta.vsix`, `-1.2.3-nightly.1.vsix`) version formats.

## Architecture

`nightly.yml` delegates to shared reusable workflow:
- **Workflow**: `salesforcecli/github-workflows/.github/workflows/vscode-publish-extensions.yml@main`
- **Scripts**: Downloaded at runtime (not stored locally)
- **Actions**: check-ci-status, calculate-artifact-name, publish-vsix

## Configuration

### Required Secrets (repo settings)
- `IDEE_GH_TOKEN` — GitHub token for version bumps/releases
- `VSCE_PERSONAL_ACCESS_TOKEN` — VS Code Marketplace
- `IDEE_OVSX_PAT` — Open VSX Registry

### Environment Variables
- `VSCE_PRE_RELEASE=true` — Set by wireit in legacy extension packaging to pass `--pre-release` flag to vsce
  - Used by: salesforcedx-vscode-core, lwc, lightning, apex-debugger, apex-oas
  - Script: `scripts/vsce-bundled-extension.ts`

### Package Scripts
- `package:packages` — Stable packaging (calls `vscode:package`)
- `package:packages:prerelease` — Prerelease packaging (calls `vscode:package:prerelease`)
  - Modern extensions: adds `--pre-release` flag to vsce
  - Legacy extensions: sets `VSCE_PRE_RELEASE=true` env var

## Packaging Workflows

`package.yml` (reusable workflow) respects `pre-release` input:
- `pre-release=true` → `npm run vscode:package:prerelease`
- `pre-release=false` (default) → `npm run vscode:package`

## Implementation Details

See:
- [github-workflows](https://github.com/salesforcecli/github-workflows)
- [apex-language-support scripts](https://github.com/forcedotcom/apex-language-support/tree/main/.github/scripts)

Repo is a **consumer** of shared infrastructure — calls reusable workflow, scripts maintained externally.
