# Nightly Prerelease Builds

Automated nightly VS Code extension builds via `salesforcecli/github-workflows` shared CI.

## Usage

### Automatic

Daily at 4 AM UTC: publishes all 16 extensions as prereleases.

### Manual Trigger

```bash
# Publish all extensions (default)
gh workflow run nightly.yml

# Publish specific extensions
gh workflow run nightly.yml -f extensions="salesforcedx-vscode-apex,salesforcedx-vscode-core"

# Dry-run mode (no actual publish)
gh workflow run nightly.yml -f dry-run=true
```

## Architecture

`nightly.yml` delegates to shared reusable workflow:
- **Workflow**: `salesforcecli/github-workflows/.github/workflows/vscode-publish-extensions.yml@main` (testing: `@ms/shared-ci-actions`)
- **Scripts**: Downloaded at runtime (not stored locally)
- **Actions**: check-ci-status, calculate-artifact-name, publish-vsix

**TEMP**: Shared workflow ref temporarily `@ms/shared-ci-actions` for testing; reverts to `@main` post-testing.

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

## Implementation Details

See:
- [github-workflows](https://github.com/salesforcecli/github-workflows)
- [apex-language-support scripts](https://github.com/forcedotcom/apex-language-support/tree/main/.github/scripts)

Repo is a **consumer** of shared infrastructure — calls reusable workflow, scripts maintained externally.
