---
name: announce-prerelease
description: Compose and send Slack announcement for pre-release builds. Summarizes changes compared to current marketplace version.
review: never
---

# Pre-release Slack Announcement

Compose Slack message announcing new pre-release build to `#platform-dev-tools`.

**Invoke:** `/announce-prerelease` or when user asks to announce pre-release to Slack.

## Steps

### 1. Identify versions

Get the pre-release version and current stable marketplace version:

```sh
# Get latest pre-release from GitHub
gh release list --repo forcedotcom/salesforcedx-vscode --limit 20 | grep -E "v[0-9]+\.[0-9]+\.[0-9]+" | head -1

# Current marketplace stable version
gh release list --repo forcedotcom/salesforcedx-vscode --exclude-pre-releases --limit 1
```

### 2. Extract changelog differences

Read `packages/salesforcedx-vscode/CHANGELOG.md` and extract changes between:
- Pre-release version (top of CHANGELOG)
- Current stable marketplace version

Focus on:
- New features (Added section)
- Bug fixes (Fixed section)
- Breaking changes (if any)
- Important notes

### 3. Compose Slack message

Format for `#platform-dev-tools`:

```
🚀 *Salesforce Extensions for VS Code v<version> Pre-release Available*

A new pre-release build is ready for testing on the marketplace.

*What's New:*
• <feature 1>
• <feature 2>

*Bug Fixes:*
• <fix 1>
• <fix 2>

*Testing:*
Install via VS Code Extensions → search "Salesforce" → switch to Pre-release version

Or install manually:
`code --install-extension salesforce.salesforcedx-vscode@<version>`

Please test and report any issues before the stable release.

📊 <link to GitHub release for full details>
```

**Formatting rules:**
- Use bullet points (•) for list items
- Keep descriptions concise (one line per item)
- Drop PR/issue numbers and technical details
- Include link to GitHub release
- Add emoji for visual appeal (🚀 🐛 ✨ 📊)

### 4. Show preview and send

Show composed message to user for review.

If Slack MCP available:
- Offer to post directly to `#platform-dev-tools`
- Or save as draft for user to send manually

Wait for user approval before posting.

### 5. Verify post

After sending, confirm message was posted successfully.

## Best Practices

- **Timing:** Send announcement shortly after pre-release is published to marketplace
- **Audience:** Engineers testing pre-releases, not end users
- **Tone:** Encouraging testing/feedback, not "this is ready for everyone"
- **Content:** Focus on testable changes, not implementation details
- **Links:** Always include link to GitHub release for full details

## Example Messages

### Feature-focused pre-release

```
🚀 *Salesforce Extensions v68.1.0 Pre-release Available*

New features ready for testing:

*Added:*
• ✨ LWC inline documentation on hover
• ✨ Apex code actions for quick fixes
• 📊 Enhanced Apex language server performance

*Fixed:*
• 🐛 SOQL Builder syntax highlighting
• 🐛 Org Browser refresh issues

Install via Extensions view → search "Salesforce" → Pre-release version

Test and share feedback! 
📋 Details: https://github.com/forcedotcom/salesforcedx-vscode/releases/tag/v68.1.0
```

### Bug fix pre-release

```
🐛 *Salesforce Extensions v68.0.1 Pre-release - Bug Fixes*

Quick bug fix build ready for testing:

*Fixed:*
• Code completion crash on large files
• Deploy errors with LWC metadata
• Authentication token refresh issues

Install pre-release from Extensions view to verify fixes.

Thanks for reporting these issues!
📋 https://github.com/forcedotcom/salesforcedx-vscode/releases/tag/v68.0.1
```

## Notes

- Pre-release announcements are **optional** - not every nightly needs announcement
- Use for significant changes or when requesting testing feedback
- Keep message brief - engineers can read full CHANGELOG if interested
- Encourage feedback and issue reporting
