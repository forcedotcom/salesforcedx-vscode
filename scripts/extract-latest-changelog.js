#!/usr/bin/env node

/**
 * Extracts only the latest release notes from CHANGELOG.md for marketplace publishing.
 * VS Code Marketplace and Open VSX have size limits, so we only include the most recent release.
 * The full changelog history is preserved in the repository and on GitHub.
 */

const fs = require('fs');
const path = require('path');

const CHANGELOG_PATH = path.join(process.cwd(), 'packages', 'salesforcedx-vscode', 'CHANGELOG.md');

/**
 * Extracts the first release section (everything up to the second version header)
 * @param {string} changelogContent - Full changelog content
 * @returns {string} - Just the latest release notes
 */
function extractLatestRelease(changelogContent) {
  const lines = changelogContent.split('\n');
  const latestReleaseLines = [];
  let foundFirstHeader = false;

  for (const line of lines) {
    // Version headers start with "# " followed by version number
    const isVersionHeader = /^# \d+\.\d+\.\d+/.test(line);

    if (isVersionHeader) {
      if (foundFirstHeader) {
        // Found the second header, stop here
        break;
      }
      foundFirstHeader = true;
    }

    latestReleaseLines.push(line);
  }

  return latestReleaseLines.join('\n').trim() + '\n';
}

/**
 * Main execution
 */
function main() {
  if (!fs.existsSync(CHANGELOG_PATH)) {
    console.error(`ERROR: CHANGELOG.md not found at ${CHANGELOG_PATH}`);
    process.exit(1);
  }

  const fullChangelog = fs.readFileSync(CHANGELOG_PATH, 'utf8');
  const latestRelease = extractLatestRelease(fullChangelog);

  // Output to stdout so it can be piped or redirected
  console.log(latestRelease);
}

// If running directly (not imported)
if (require.main === module) {
  main();
}

module.exports = { extractLatestRelease };
