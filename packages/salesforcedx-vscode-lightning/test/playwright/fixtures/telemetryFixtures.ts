/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createDesktopTest, MINIMAL_ORG_ALIAS } from '@salesforce/playwright-vscode-ext';

// Lightning depends on the CORE extension (not just services), so this fixture loads core and
// launches with a real minimal org so org-identity telemetry props (orgId, isScratch, orgShape,
// orgEdition, …) get populated in BOTH pipelines.
//
// The default desktop fixture sets telemetry.telemetryLevel:'off', which prevents ANY reporter
// (including the local TelemetryFile) from being instantiated. We flip it back on and turn on
// localTelemetryLogging so the class-based pipeline's events are diverted to
// {workspace}/salesforcedx-vscode-core-telemetry.json (the AppInsights event *shape*, since the
// real AppInsights client is never created in dev/test mode — see determineReporters.ts).
//
// enableFileTraces stays true (fixture default) so the services Effect/O11y pipeline keeps writing
// spans to ~/.sf/vscode-spans/*.jsonl.
export const telemetryDesktopTest = createDesktopTest({
  fixturesDir: __dirname,
  orgAlias: MINIMAL_ORG_ALIAS,
  additionalExtensionDirs: ['salesforcedx-vscode-core'],
  disableOtherExtensions: false,
  userSettings: {
    'telemetry.telemetryLevel': 'all',
    'salesforcedx-vscode-core.telemetry.enabled': true,
    'salesforcedx-vscode-core.advanced.localTelemetryLogging': 'true',
    'salesforcedx-vscode-lightning.advanced.localTelemetryLogging': 'true'
  }
});
