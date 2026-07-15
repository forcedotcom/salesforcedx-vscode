# Nightly Release Design for VS Code Extension Monorepos

## Overview

This document describes the architecture and implementation approach for automated nightly/pre-release builds in VS Code extension monorepos, using shared CI/CD infrastructure from the `salesforcecli/github-workflows` repository.

## Problem Statement

VS Code extension monorepos need:
1. **Automated nightly builds** from the develop branch
2. **Selective extension publishing** (changed extensions only, or all, or specific list)
3. **Shared CI/CD logic** to avoid duplicating workflow code across multiple repos
4. **Pre-release version management** with automatic version bumping
5. **Dry-run capabilities** for testing the full release flow without publishing

## Architecture

### High-Level Components

```
┌─────────────────────────────────────────────────────────────┐
│ Consumer Repo (salesforcedx-vscode)             │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ .github/workflows/nightly.yml                        │  │
│  │  - Triggered by schedule (cron) or manual dispatch   │  │
│  │  - Calls reusable workflows from github-workflows   │  │
│  └──────────────────────────────────────────────────────┘  │
│                          │                                   │
│                          │ uses                              │
│                          ▼                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Extension Configuration (in workflow YAML)           │  │
│  │  - Explicitly declares extension paths               │  │
│  │  - Specifies release mode (all/changed/specific)     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ delegates to
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ Shared Workflows Repo (salesforcecli/github-workflows)     │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Reusable Workflows (GitHub Actions)                  │  │
│  │  - vscode-make-pr-for-nightly.yml                    │  │
│  │  - vscode-automerge-nightly-pr.yml                   │  │
│  │  - vscode-draft-release-on-merge.yml                 │  │
│  │                                                        │  │
│  │ Composite Actions                                    │  │
│  │  - retry (for npm install retries)                   │  │
│  │  - Other shared GitHub Actions steps                 │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  All logic is in workflows/actions - no npm dependency!   │
└─────────────────────────────────────────────────────────────┘
```

### Workflow Phases

#### Workflow Inputs: Extension Declaration

**Design Choice: Explicit vs Discovery**

Instead of auto-discovering extensions, the **consumer repo explicitly declares** their extension paths:

```yaml
# .github/workflows/nightly.yml
jobs:
  release-extensions:
    uses: salesforcecli/github-workflows/.github/workflows/nightly-extensions.yml@main
    with:
      extensions:
        - packages/salesforcedx-vscode-apex
        - packages/salesforcedx-vscode-core
        - packages/salesforcedx-vscode-lwc
      # OR for "changed" detection:
      extension-paths: 'packages/*'  # glob pattern
      release-mode: changed  # all | changed | specific
```

**Benefits of Explicit Declaration:**
- ✅ **No CLI tools needed** - no npm dependency for discovery
- ✅ **Works for any structure** - monorepos, single extensions, non-standard layouts
- ✅ **Consumer has full control** - explicitly declare what gets released
- ✅ **Simpler and more maintainable** - no magic discovery logic
- ✅ **Clearer intent** - explicit is better than implicit

**For "changed" detection:**
```yaml
extension-paths: 'packages/salesforcedx-vscode-*'
release-mode: changed
base-branch: main
```

The workflow can still detect changes within the declared paths using simple git diff.

**Example Configurations:**

1. **Monorepo with all extensions:**
```yaml
with:
  extension-paths: 'packages/salesforcedx-vscode-*'
  release-mode: all
```

2. **Monorepo with changed only:**
```yaml
with:
  extension-paths: 'packages/salesforcedx-vscode-*'
  release-mode: changed
  base-branch: main
```

3. **Single extension repo:**
```yaml
with:
  extension-paths: '.'
  release-mode: all
```

4. **Mixed structure:**
```yaml
with:
  extension-paths: |
    packages/libraries/foo
    packages/extensions/bar
    packages/extensionPacks/baz
  release-mode: changed
```

5. **Specific extensions only:**
```yaml
with:
  extensions: |
    packages/salesforcedx-vscode-apex
    packages/salesforcedx-vscode-core
  release-mode: all
```

#### Phase 1: Nightly Release Flow
- **Workflow:** `nightly-extensions.yml`
- Takes explicit extension list or paths as input
- Calls three sub-workflows in sequence:
  1. **Make PR:** Creates a PR with version bumps
  2. **Automerge:** Auto-merges the PR after checks pass
  3. **Draft Release:** Creates GitHub releases and publishes VSIXes

## Implementation: Pure GitHub Actions

**No npm dependencies required!** The shared workflows are accessed directly via GitHub Actions `uses:` syntax.

### How It Works

```yaml
# Consumer repo calls shared workflow
jobs:
  nightly:
    uses: salesforcecli/github-workflows/.github/workflows/vscode-nightly-release.yml@main
    with:
      extension-paths: 'packages/*'
      release-mode: changed
```

GitHub Actions handles everything:
- ✅ Clones the shared workflow repository
- ✅ Executes the workflow with provided inputs
- ✅ No npm install, no package.json entries
- ✅ Works across any repository structure

### What Gets Eliminated

By using pure GitHub Actions workflows:
- ❌ No npm git dependency issues
- ❌ No TypeScript CLI tools to build/bundle
- ❌ No cross-repo linking problems
- ❌ No dependency management
- ❌ No installation failures

## Testing

### Dry-Run in CI

Test the workflow without actually publishing:

```bash
gh workflow run nightly.yml \
  --field branch=develop \
  --field dry-run=true
```

This will:
- ✅ Run all detection and planning logic
- ✅ Build VSIXes
- ✅ Validate the full flow
- ❌ Skip git push, PR creation, and publishing

### Local Validation

Validate your extension paths configuration:

```yaml
# Test your glob patterns
- name: Validate extension paths
  run: |
    for path in packages/salesforcedx-vscode-*; do
      if [ -d "$path" ] && [ -f "$path/package.json" ]; then
        echo "✓ Found extension: $path"
      fi
    done
```

## Future Improvements

1. **Monorepo tool integration:** Consider using Lerna, Nx, or Turborepo for better monorepo management
2. **Rollback support:** Add automated rollback if nightly releases fail validation
3. **Metrics and notifications:** Track release success rates, notify on failures
4. **Canary releases:** Support gradual rollout to subset of users
5. **Parallel publishing:** Publish to multiple registries concurrently

## References

- [GitHub Actions Reusable Workflows](https://docs.github.com/en/actions/using-workflows/reusing-workflows)
- [VS Code Extension Publishing](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [npm Git Dependencies](https://docs.npmjs.com/cli/v10/configuring-npm/package-json#git-urls-as-dependencies)
- [Open VSX Registry](https://open-vsx.org/)

## Contact

For questions or issues with this design, reach out to:
- **Team:** VS Code Extensions Team
- **Repo:** https://github.com/forcedotcom/salesforcedx-vscode-ci-testing
- **Shared Infrastructure:** https://github.com/salesforcecli/github-workflows

---

*Last Updated: 2026-06-18*
