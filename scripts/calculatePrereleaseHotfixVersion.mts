#!/usr/bin/env node
/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import process from 'node:process';

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

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const firstObject = (value: unknown) => (Array.isArray(value) && isObject(value[0]) ? value[0] : undefined);

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

const fetchJson = async (url: string, init: RequestInit | undefined, registry: string) => {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    throw new Error(`${registry} query failed: ${String(error)}`);
  }
  if (!response.ok) {
    throw new Error(`${registry} query failed: HTTP ${response.status}`);
  }
  try {
    const data: unknown = await response.json();
    return data;
  } catch (error) {
    throw new Error(`${registry} response JSON parsing failed: ${String(error)}`);
  }
};

const getMarketplaceVersion = async () => {
  const data = await fetchJson(
    'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json;api-version=3.0-preview.1'
      },
      body: JSON.stringify({
        filters: [{ criteria: [{ filterType: 7, value: MARKETPLACE_EXTENSION_ID }] }],
        flags: 439
      })
    },
    'Marketplace'
  );
  const result = isObject(data) ? firstObject(data.results) : undefined;
  const extension = firstObject(result?.extensions);
  const version = firstObject(extension?.versions)?.version;
  if (typeof version !== 'string' || version.length === 0) {
    throw new Error('Marketplace response did not contain a version');
  }
  return version;
};

const getOpenVsxVersion = async () => {
  const data = await fetchJson(
    `https://open-vsx.org/api/${OPENVSX_NAMESPACE}/${OPENVSX_EXTENSION}`,
    undefined,
    'Open VSX'
  );
  const version = isObject(data) ? data.version : undefined;
  if (typeof version !== 'string' || version.length === 0) {
    throw new Error('Open VSX response did not contain a version');
  }
  return version;
};

const main = async () => {
  const [marketplaceVersion, openVsxVersion] = await Promise.all([getMarketplaceVersion(), getOpenVsxVersion()]);

  console.error(`Marketplace latest published version: ${marketplaceVersion}`);
  console.error(`Open VSX latest published version: ${openVsxVersion}`);

  const latest = compareVersions(marketplaceVersion, openVsxVersion) >= 0 ? marketplaceVersion : openVsxVersion;
  const [major, minor, patch] = latest.split('.').map(n => parseInt(n, 10));

  if ([major, minor, patch].some(Number.isNaN)) {
    throw new Error(`Invalid version components in '${latest}'`);
  }

  console.log(`${major}.${minor}.${patch + 1}`);
};

try {
  await main();
} catch (error) {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
