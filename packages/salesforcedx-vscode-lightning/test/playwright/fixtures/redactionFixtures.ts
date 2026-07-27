/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createDesktopTest } from '@salesforce/playwright-vscode-ext';
import * as crypto from 'node:crypto';

/**
 * Tail bytes of the planted token, unique per run so a stale file from an earlier run can never
 * satisfy (or break) the "raw secret is absent" assertion. Deliberately contains `-`, `=` and `+`:
 * `@salesforce/core`'s own `accessTokenRegex` tail (`[.\w]*`) stops at those, so this value also
 * proves the widened tail in redactSecrets.ts.
 */
export const PLANTED_TOKEN_TAIL = `AQE-plant=+${crypto.randomBytes(8).toString('base64url')}`;

/**
 * Shaped like a real opaque Salesforce access token: `00D` org prefix, `!`, then the secret. The `!`
 * is what makes it match — a bare `00D...` orgId must NOT be redacted (ADR-0019).
 */
const PLANTED_TOKEN = `00D000000000000!${PLANTED_TOKEN_TAIL}`;

/**
 * Plants the token where it is guaranteed to reach BOTH egress files with no org and no failing
 * command: `spanTransformProcessor` stamps `telemetry-tag` onto every root span as the `telemetryTag`
 * attribute, and the Azure exporter carries span attributes into `data.baseData.properties`.
 *
 * `useVsix: false` is REQUIRED, not a default restatement: auraE2E.yml sets `E2E_FROM_VSIX=1`, and
 * VSIX mode launches with `--extensions-dir` instead of `--extensionDevelopmentPath`, which makes
 * `ExtensionMode.Production` — `isLocalDivertMode()` is then false and nothing is written to
 * `~/.sf/vscode-appinsights/`.
 *
 * `additionalExtensionDirs` + `disableOtherExtensions` mirror telemetryFixtures: lightning commands
 * come from the core extension.
 */
export const redactionDesktopTest = createDesktopTest({
  fixturesDir: __dirname,
  useVsix: false,
  additionalExtensionDirs: ['salesforcedx-vscode-core'],
  disableOtherExtensions: false,
  userSettings: {
    'telemetry.telemetryLevel': 'all',
    'salesforcedx-vscode-core.telemetry.enabled': true,
    'salesforcedx-vscode-core.telemetry-tag': PLANTED_TOKEN
  }
});
