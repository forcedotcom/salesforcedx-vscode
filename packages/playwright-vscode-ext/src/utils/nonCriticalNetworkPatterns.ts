/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export const NON_CRITICAL_NETWORK_PATTERNS = [
  'webPackagePaths.js',
  'workbench.web.main.nls.js',
  'workbench.web.main.internal.js',
  'marketplace.visualstudio.com',
  'vscode-unpkg.net', // VS Code extension marketplace CDN
  'scratchOrgInfo', // asking the org if it's a devhub during auth ?
  'Package2Member', // Tooling API Package2Member can return 400 in scratch orgs; apex-testing handles it and falls back
  '.a4drules', // @salesforce/templates optional project template assets (react internal/external app templates) not bundled for Apex
  'typescript-language-features', // TS extension 404s for package.json etc in web
  'applicationinsights.azure.com', // Azure Application Insights telemetry (e.g. HTTP 439 throttling) — not critical to extension behavior
  // Salesforce OAuth userinfo endpoint (can 403/500 if session is invalid/expired in web,
  // non-critical for these tests.  sfdx-core will query user/organization sobjects as fallback )
  // https://github.com/forcedotcom/sfdx-core/blob/8d378c3a6f88a1d370ddc3f43954a90d7159377d/src/org/authInfo.ts#L1236
  'services/oauth2/userinfo',
  // Salesforce sObject describe endpoint — LSP/autocomplete may describe objects (including internal
  // types like "Object") as-you-type; describe 404s are non-critical to test assertions
  '/describe'
] as const;
