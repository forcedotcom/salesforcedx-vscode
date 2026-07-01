# Changelog Strategy

## Overview

This repository maintains a **full changelog history** in git while publishing **only the latest release notes** to VS Code Marketplace and Open VSX (due to size constraints).

## How It Works

### 1. Changelog Generation (Weekly)

When `generateChangelog.yml` runs:
- [scripts/change-log-generator-utils.js](scripts/change-log-generator-utils.js) **prepends** new release notes to existing CHANGELOG.md
- Full history accumulates over time in the repository
- No truncation occurs

### 2. Packaging for Marketplace

When `buildAll.yml` creates VSIX packages:

**Before packaging:**
- [scripts/prepare-changelog-for-marketplace.js](scripts/prepare-changelog-for-marketplace.js) runs
- Backs up full CHANGELOG.md to CHANGELOG.full.md
- Replaces CHANGELOG.md with just the latest release section
- VSIX packages now contain only recent release notes (smaller size)

**After packaging:**
- [scripts/restore-full-changelog.js](scripts/restore-full-changelog.js) runs
- Restores full CHANGELOG.md from backup
- Deletes temporary backup file
- Full history preserved in git

### 3. Publishing

- VS Code Marketplace and Open VSX show the truncated changelog from the VSIX
- GitHub repository always has the full history
- GitHub Releases also contain full release notes in their body

## Files Changed

### Scripts

- **[scripts/change-log-generator-utils.js](scripts/change-log-generator-utils.js)** - Modified `writeChangeLog()` to prepend instead of replace
- **[scripts/extract-latest-changelog.js](scripts/extract-latest-changelog.js)** - NEW: Extracts just the latest release section
- **[scripts/prepare-changelog-for-marketplace.js](scripts/prepare-changelog-for-marketplace.js)** - NEW: Temporarily replaces full changelog with latest release
- **[scripts/restore-full-changelog.js](scripts/restore-full-changelog.js)** - NEW: Restores full changelog after packaging
- **[scripts/restore-changelog-history-from-github.js](scripts/restore-changelog-history-from-github.js)** - NEW: ONE-TIME script to restore historical entries from GitHub releases

### Workflows

- **[.github/workflows/buildAll.yml](.github/workflows/buildAll.yml)** - Added steps to prepare/restore changelog around packaging

### Configuration

- **[.gitignore](.gitignore)** - Ignores temporary backup files

## One-Time Restoration

To restore historical changelog entries that were previously truncated:

```bash
# Dry run to preview
node scripts/restore-changelog-history-from-github.js --dry-run

# Actually restore
node scripts/restore-changelog-history-from-github.js
```

This script:
- Fetches all extension releases from GitHub
- Extracts release notes from each release body
- Reconstructs the full CHANGELOG.md with all historical entries
- Creates a timestamped backup of the current changelog

**Prerequisites:**
- `gh` CLI must be installed and authenticated
- Run from repository root

## Benefits

✅ **Full history preserved** - All release notes remain in git and on GitHub  
✅ **Marketplace compliant** - Published packages stay within size limits  
✅ **Better user experience** - GitHub users see complete history  
✅ **Automated** - No manual intervention needed after initial setup  
✅ **Reversible** - Backup created before any changes  

## Maintenance

### Adding New Releases

No changes needed! The workflow automatically:
1. Generates new changelog section
2. Prepends it to existing history
3. Packages with latest release only
4. Restores full history after packaging

### Verifying Full History

```bash
# Check CHANGELOG has multiple releases
grep -c "^# [0-9]" packages/salesforcedx-vscode/CHANGELOG.md

# View first few releases
head -100 packages/salesforcedx-vscode/CHANGELOG.md
```

### Manual Testing

```bash
# Test extraction
node scripts/extract-latest-changelog.js

# Test prepare/restore cycle
node scripts/prepare-changelog-for-marketplace.js
# (CHANGELOG.md now has only latest release)
node scripts/restore-full-changelog.js
# (CHANGELOG.md restored to full history)
```

## Troubleshooting

### Full changelog not accumulating

Check that [scripts/change-log-generator-utils.js](scripts/change-log-generator-utils.js) `writeChangeLog()` function uses:
- `fs.readFileSync()` to read existing content
- Concatenation to prepend new content
- `fs.writeFileSync()` (not `fs.openSync()` with `'w+'`)

### VSIX too large

The marketplace preparation should handle this automatically. If still too large:
- Check [scripts/extract-latest-changelog.js](scripts/extract-latest-changelog.js) is correctly extracting only one release
- Verify [scripts/prepare-changelog-for-marketplace.js](scripts/prepare-changelog-for-marketplace.js) runs before packaging

### Backup file committed to git

Ensure [.gitignore](.gitignore) contains:
```
packages/salesforcedx-vscode/CHANGELOG.full.md
packages/salesforcedx-vscode/CHANGELOG.md.backup-*
```

## Related Documentation

- [contributing/publishing.md](contributing/publishing.md) - Release workflow
- [.claude/skills/changelog/SKILL.md](.claude/skills/changelog/SKILL.md) - Changelog polishing process
