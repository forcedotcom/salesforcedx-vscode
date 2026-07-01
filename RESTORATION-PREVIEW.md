# Changelog Restoration Preview

## What the restoration script produces

The script fetches 189 releases from GitHub and concatenates their release notes. Here's what the structure looks like:

```markdown
# 67.3.0 - July 1, 2026

## Added
#### salesforcedx-apex-replay-debugger
- The **Variables** panel now sorts variables alphabetically...

## Fixed
#### salesforcedx-apex-debugger
- We fixed a bug where parent-relationship fields showed `[object Object]`...

# 67.2.0 - June 24, 2026

## Added
#### salesforcedx-vscode
- We added **Agentforce Vibes Autocomplete**...

## Fixed
#### salesforcedx-vscode-apex
- We fixed a bug where the extension could freeze VS Code...

# 67.1.0 - June 18, 2026

## Added
#### salesforcedx-vscode-apex
- We updated the Apex Language Server with Summer '26...

## Fixed
#### salesforcedx-vscode-org
- We fixed a bug where the Apex test view didn't refresh...

# 66.15.0 - June 10, 2026
...continues for 189 releases...

# 60.0.0 - October 2024
(older releases have much longer entries)
...

# 50.0.0 - 2023
...

# 40.0.0 - 2022
...
```

## Key Points

### No Duplicates
Each release appears exactly once because:
- GitHub release bodies already contain only that week's changes
- The script just concatenates them in order (newest to oldest)
- No overlap or duplication

### Size Breakdown
- **Recent releases (v66-67)**: Small, ~10-30 lines each (weekly format)
- **Older releases (v60 and earlier)**: Much larger, 100-2000 lines (full format at the time)
- **Total**: ~9.8MB, 189 releases

### Format Consistency
- All releases follow the same structure:
  ```
  # VERSION - DATE
  ## Added
  #### package-name
  - change description ([PR #123](link))
  ## Fixed
  #### package-name
  - fix description ([PR #456](link))
  ```

### What Changed Historically

Looking at the GitHub releases, it appears:
- **v60 and earlier** (~2024 and before): Release notes were much more detailed/comprehensive
- **v65-present** (2025-2026): Release notes became weekly summaries (current format)
- **v65.0.0 specifically**: Just a one-liner ("core alignment, no functional changes")

## Result

The restoration script will give you a complete, chronological changelog with:
- ✅ All 189 releases included
- ✅ No duplicates (each release appears once)
- ✅ Consistent format throughout
- ✅ Full history from initial release to present
- ⚠️ Older releases are much more detailed than recent ones (reflects historical practice)

## Running It

```bash
# Preview first (recommended)
node scripts/restore-changelog-history-from-github.js --dry-run

# Shows first 2000 chars preview
# Reports total size: ~9.8MB

# Actually restore (creates backup automatically)
node scripts/restore-changelog-history-from-github.js
```

After restoration, your CHANGELOG.md will have the complete history, and the new weekly workflow will keep appending to it going forward.
