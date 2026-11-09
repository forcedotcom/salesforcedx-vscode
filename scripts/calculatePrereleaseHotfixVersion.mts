#!/usr/bin/env node
/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export {};

/*
 * Calculate the next emergency pre-release hotfix version.
 * Bumps the patch on top of whichever registry - VS Code Marketplace or
 * Open VSX - currently has the higher published version of salesforcedx-vscode,
 * since the two can drift out of sync with each other.
 *
 * Usage: node calculatePrereleaseHotfixVersion.mts [overrideVersion]
 *
 * Examples:
 *   node calculatePrereleaseHotfixVersion.mts
 *   # Marketplace at 67.17.9, Open VSX at 67.17.10 -> Output: 67.17.11
 *
 *   node calculatePrereleaseHotfixVersion.mts 67.17.20
 *   # Output: 67.17.20 (override)
 */

const MARKETPLACE_EXTENSION_ID = 'salesforce.salesforcedx-vscode';
const OPENVSX_NAMESPACE = 'salesforce';
const OPENVSX_EXTENSION = 'salesforcedx-vscode';

const overrideVersion = process.argv[2];

if (overrideVersion) {
  const semverRegex = /^[0-9]+\.[0-9]+\.[0-9]+$/;
  if (!semverRegex.test(overrideVersion)) {
    console.error(`Error: Invalid version format '${overrideVersion}'`);
    console.error('Expected format: X.Y.Z (e.g., 67.17.11)');
    process.exit(1);
  }
  console.log(overrideVersion);
  process.exit(0);
}

const compareVersions = (a: string, b: string) => {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (partsA[i] !== partsB[i]) {
      return partsA[i] - partsB[i];
    }
  }
  return 0;
};

const getMarketplaceVersion = async () => {
  const response = await fetch('https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json;api-version=3.0-preview.1'
    },
    body: JSON.stringify({
      filters: [{ criteria: [{ filterType: 7, value: MARKETPLACE_EXTENSION_ID }] }],
      flags: 439
    })
  });
  if (!response.ok) {
    throw new Error(`Marketplace query failed: HTTP ${response.status}`);
  }
  const data: unknown = await response.json();
  if (typeof data !== 'object' || data === null || !('results' in data) || !Array.isArray(data.results)) {
    throw new Error('Marketplace response did not contain a version');
  }
  const result: unknown = data.results[0];
  const extensions: unknown =
    typeof result === 'object' && result !== null && 'extensions' in result ? result.extensions : undefined;
  const extension: unknown = Array.isArray(extensions) ? extensions[0] : undefined;
  const versions: unknown =
    typeof extension === 'object' && extension !== null && 'versions' in extension ? extension.versions : undefined;
  const firstVersion: unknown = Array.isArray(versions) ? versions[0] : undefined;
  const version =
    typeof firstVersion === 'object' && firstVersion !== null && 'version' in firstVersion
      ? firstVersion.version
      : undefined;
  if (typeof version !== 'string' || !version) {
    throw new Error('Marketplace response did not contain a version');
  }
  return version;
};

const getOpenVsxVersion = async () => {
  const response = await fetch(`https://open-vsx.org/api/${OPENVSX_NAMESPACE}/${OPENVSX_EXTENSION}`);
  if (!response.ok) {
    throw new Error(`Open VSX query failed: HTTP ${response.status}`);
  }
  const data: unknown = await response.json();
  if (
    typeof data !== 'object' ||
    data === null ||
    !('version' in data) ||
    typeof data.version !== 'string' ||
    !data.version
  ) {
    throw new Error('Open VSX response did not contain a version');
  }
  return data.version;
};

const main = async () => {
  const [marketplaceVersion, openVsxVersion] = await Promise.all([getMarketplaceVersion(), getOpenVsxVersion()]);

  console.error(`Marketplace latest published version: ${marketplaceVersion}`);
  console.error(`Open VSX latest published version: ${openVsxVersion}`);

  const latest = compareVersions(marketplaceVersion, openVsxVersion) >= 0 ? marketplaceVersion : openVsxVersion;
  const [major, minor, patch] = latest.split('.').map(n => parseInt(n, 10));

  if ([major, minor, patch].some(Number.isNaN)) {
    console.error(`Error: Invalid version components in '${latest}'`);
    process.exit(1);
  }

  console.log(`${major}.${minor}.${patch + 1}`);
};

main().catch((error: unknown) => {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
