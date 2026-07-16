# Nightly Prerelease Builds

Automated nightly builds for VS Code extensions using shared CI infrastructure from `salesforcecli/github-workflows`.

## Usage

### Automatic Nightly Builds

Runs daily at 4 AM UTC (scheduled) - publishes all 16 extensions as prereleases.

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

The `nightly.yml` workflow delegates to a shared reusable workflow:
- **Shared workflow**: `salesforcecli/github-workflows/.github/workflows/vscode-publish-extensions.yml@main`
- **Scripts**: Downloaded at runtime from github-workflows (not stored locally)
- **Composite actions**: Referenced from github-workflows (check-ci-status, calculate-artifact-name, publish-vsix)

## Configuration

Required GitHub secrets (configured in repo settings):
- `IDEE_GH_TOKEN` - GitHub token for version bumps/releases
- `VSCE_PERSONAL_ACCESS_TOKEN` - VS Code Marketplace publishing
- `IDEE_OVSX_PAT` - Open VSX Registry publishing

## Implementation Details

For architecture and implementation details, see:
- [github-workflows repo](https://github.com/salesforcecli/github-workflows)
- [apex-language-support scripts README](https://github.com/forcedotcom/apex-language-support/tree/main/.github/scripts)

The salesforcedx-vscode repo is a **consumer** of the shared infrastructure - it calls the reusable workflow and doesn't maintain scripts locally.
