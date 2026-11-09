#!/usr/bin/env node
/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Effect, Schema } from 'effect';

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

const MarketplaceResponseSchema = Schema.Struct({
  results: Schema.NonEmptyArray(
    Schema.Struct({
      extensions: Schema.NonEmptyArray(
        Schema.Struct({
          versions: Schema.NonEmptyArray(Schema.Struct({ version: Schema.NonEmptyString }))
        })
      )
    })
  )
});
const OpenVsxResponseSchema = Schema.Struct({ version: Schema.NonEmptyString });

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

const fetchJson = Effect.fn('fetchJson')(function* (url: string, init: RequestInit | undefined, registry: string) {
  const response = yield* Effect.tryPromise({
    try: () => fetch(url, init),
    catch: error => new Error(`${registry} query failed: ${String(error)}`)
  });
  if (!response.ok) {
    return yield* Effect.fail(new Error(`${registry} query failed: HTTP ${response.status}`));
  }
  return yield* Effect.tryPromise({
    try: () => response.json(),
    catch: error => new Error(`${registry} response JSON parsing failed: ${String(error)}`)
  }).pipe(Effect.map((data): unknown => data));
});

const getMarketplaceVersion = Effect.fn('getMarketplaceVersion')(function* () {
  const data = yield* fetchJson(
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
  const marketplaceResponse = yield* Schema.decodeUnknown(MarketplaceResponseSchema)(data).pipe(
    Effect.mapError(() => new Error('Marketplace response did not contain a version'))
  );
  return marketplaceResponse.results[0].extensions[0].versions[0].version;
});

const getOpenVsxVersion = Effect.fn('getOpenVsxVersion')(function* () {
  const data = yield* fetchJson(
    `https://open-vsx.org/api/${OPENVSX_NAMESPACE}/${OPENVSX_EXTENSION}`,
    undefined,
    'Open VSX'
  );
  const openVsxResponse = yield* Schema.decodeUnknown(OpenVsxResponseSchema)(data).pipe(
    Effect.mapError(() => new Error('Open VSX response did not contain a version'))
  );
  return openVsxResponse.version;
});

const main = Effect.gen(function* () {
  const [marketplaceVersion, openVsxVersion] = yield* Effect.all([getMarketplaceVersion(), getOpenVsxVersion()], {
    concurrency: 'unbounded'
  });

  yield* Effect.sync(() => {
    console.error(`Marketplace latest published version: ${marketplaceVersion}`);
    console.error(`Open VSX latest published version: ${openVsxVersion}`);
  });

  const latest = compareVersions(marketplaceVersion, openVsxVersion) >= 0 ? marketplaceVersion : openVsxVersion;
  const [major, minor, patch] = latest.split('.').map(n => parseInt(n, 10));

  if ([major, minor, patch].some(Number.isNaN)) {
    return yield* Effect.fail(new Error(`Invalid version components in '${latest}'`));
  }

  yield* Effect.sync(() => console.log(`${major}.${minor}.${patch + 1}`));
});

await main.pipe(
  Effect.catchAll(error =>
    Effect.sync(() => {
      console.error(`Error: ${error.message}`);
      process.exitCode = 1;
    })
  ),
  Effect.runPromise
);
