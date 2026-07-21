#!/usr/bin/env node

/**
 * List all VS Code extension names from the monorepo workspace.
 *
 * Usage: node scripts/list-vscode-extensions.js
 *
 * Scans all packages in the workspace and outputs a comma-separated list
 * of VS Code extension names (those with "engines.vscode" in package.json).
 *
 * Example output: salesforcedx-vscode-apex,salesforcedx-vscode-core,...
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const PACKAGES_DIR = path.join(REPO_ROOT, 'packages');

// Find all VS Code extensions in packages/
const extensions = [];
const packageDirs = fs.readdirSync(PACKAGES_DIR);

for (const dir of packageDirs) {
  const packageJsonPath = path.join(PACKAGES_DIR, dir, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    continue;
  }

  try {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    // Publishable VS Code extensions have "engines.vscode", "publisher", and "categories"
    // Only include extensions with names starting with "salesforcedx-vscode-"
    // This filters out language servers, scoped packages (@salesforce/*), and internal packages
    if (
      pkg.engines &&
      pkg.engines.vscode &&
      pkg.publisher &&
      pkg.categories &&
      pkg.categories.length > 0 &&
      pkg.name.startsWith('salesforcedx-vscode-')
    ) {
      extensions.push(pkg.name);
    }
  } catch (err) {
    console.error(`Warning: Failed to parse ${packageJsonPath}: ${err.message}`, { file: process.stderr });
  }
}

if (extensions.length === 0) {
  console.error('No VS Code extensions found in packages/');
  process.exit(1);
}

// Sort for consistent output
extensions.sort();

process.stdout.write(extensions.join(','));
