/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

process.argv.push('--lit-migration');
await import('../esbuild.config.mjs');
await import('./verify-lit-migration-parity.mjs');
