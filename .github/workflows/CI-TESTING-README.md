# CI Testing Infrastructure

This repo is a **test environment** for validating salesforcecli/github-workflows changes before production deployment.

## ⚠️ Important Safety Rules

1. **ALWAYS DRY-RUN**: All workflows are configured with `dry-run: true` to prevent accidental marketplace publishes
2. **NO REAL PUBLISHING**: This repo should NEVER publish to the real VS Code Marketplace
3. **TEST ONLY**: Use this to validate workflow logic, not to release actual extensions

## Current Setup

### Nightly Builds ✅
- **Schedule**: Daily at 4 AM UTC  
- **Status**: Working
- **Workflow**: [nightly.yml](nightly.yml) → uses shared `vscode-publish-extensions.yml`
- **What it does**:
  - Bumps versions (odd minor: 66.15.0 → 66.15.1)
  - Creates nightly tags: `v66.15.x-nightly.develop.YYYYMMDD`
  - Builds 16 VSIX packages
  - Creates GitHub Releases with artifacts
  - **LOGS** what would be published (doesn't actually publish)

### Stable Publishing ✅
- **Trigger**: GitHub releases (type: `released`)
- **Status**: Configured with shared workflows
- **Workflow**: [publishVSCode.yml](publishVSCode.yml) → uses shared `vscode-publish-extensions.yml`
- **Integrations**: 
  - CTC (Change Tracking Case) for compliance
  - Code Builder Web dispatch
  - GUS build tracking
- **What it does**:
  - Publishes all 16 extensions from a release
  - **LOGS** what would be published (doesn't actually publish)
  - Maintains all Salesforce-specific integrations (CTC, CBW, GUS)

### Promotion Pipeline ⚠️
- **Schedule**: Wednesdays at 7 AM UTC (configured but not actively used)
- **Status**: Available for testing promotion logic if needed
- **Workflow**: [promote-prerelease.yml](promote-prerelease.yml) → uses shared `vscode-promote-prerelease.yml`
- **Purpose**: Tests the promotion workflow in dry-run mode

## Tag Formats

### Nightly Tags (Created Automatically)
```
v66.15.0-nightly.develop.20260627
v66.15.1-nightly.develop.20260628
v66.15.2-nightly.develop.20260629
```

### Tracking Tags (Logged in dry-run, not created)
These would be created by real marketplace publishes:
```
marketplace-prerelease-salesforcedx-vscode-suite-v66.15.0
marketplace-stable-salesforcedx-vscode-suite-v66.16.0
```

Since we're always in dry-run mode, these tags are only logged, not actually created.

## How It Works

### Nightly Tag → Tracking Tag Relationship

- **One nightly build** = **One nightly tag** = **16 extensions** (all at the same version)
- **One promotion** = **One tracking tag** (marks that entire nightly build as promoted)

Example:
```
v66.15.0-nightly.develop.20260627
  ↓ contains
  - salesforcedx-vscode-apex-66.15.0.vsix
  - salesforcedx-vscode-core-66.15.0.vsix
  - ... (14 more extensions)
  ↓ if promoted, would create
marketplace-prerelease-salesforcedx-vscode-suite-v66.15.0
```

## Testing the Pipeline

### Test Nightly Build
```bash
gh workflow run nightly.yml --repo forcedotcom/salesforcedx-vscode-ci-testing
```

Check the run logs - you should see dry-run messages like:
```
🔄 DRY RUN: Would create release v66.15.3-nightly.develop.20260630
🔄 DRY RUN: Would send Slack notification
✅ DRY RUN complete
```

### Test Promotion Workflow
```bash
gh workflow run promote-prerelease.yml --repo forcedotcom/salesforcedx-vscode-ci-testing
```

Expected output:
```
Finding nightly tags older than 7 days...
Found eligible nightly: v66.15.0-nightly.develop.20260627
DRY RUN: Would publish to VS Code Marketplace
DRY RUN: Would publish to Open VSX
DRY RUN: Would create and push tag marketplace-prerelease-salesforcedx-vscode-suite-v66.15.0
```

### Verify No Actual Publishing

After any successful run, verify:
- ✅ Nightly tags created: `git tag --list "*-nightly.*"`
- ✅ GitHub Releases exist with VSIX artifacts
- ❌ NO marketplace tracking tags created (check: `git tag --list "marketplace-*"`)
- ❌ NOT published to VS Code Marketplace (check marketplace.visualstudio.com)
- ❌ NOT published to Open VSX (check open-vsx.org)

## Updating to Main Branch

Once salesforcecli/github-workflows PR #158 merges:

1. Update `.github/workflows/nightly.yml`:
   ```yaml
   uses: salesforcecli/github-workflows/.github/workflows/vscode-publish-extensions.yml@main
   ```

2. Update `.github/workflows/promote-prerelease.yml`:
   ```yaml
   uses: salesforcecli/github-workflows/.github/workflows/vscode-promote-prerelease.yml@main
   ```

## Workflow Safety Features

Both workflows have safety features to prevent accidental real publishes:

1. **Forced dry-run**: `dry-run: true` is hardcoded in workflow calls
2. **Comment warnings**: Clear comments explain this is a test repo
3. **Dry-run logging**: All actions log what they would do instead of doing it

To actually publish from this repo (NOT RECOMMENDED), you would need to:
1. Edit the workflow files to remove `dry-run: true`
2. Commit the changes
3. Run the workflow

The extra steps provide intentional friction to prevent accidents.

## Reference

- **Main repo**: https://github.com/forcedotcom/salesforcedx-vscode
- **Shared workflows**: https://github.com/salesforcecli/github-workflows  
- **PR #158**: https://github.com/salesforcecli/github-workflows/pull/158
- **apex-language-support reference**: https://github.com/forcedotcom/apex-language-support/pull/514
