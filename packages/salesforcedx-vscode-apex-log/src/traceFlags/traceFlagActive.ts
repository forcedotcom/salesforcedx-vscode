/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { TraceFlagItem } from 'salesforcedx-vscode-services';

/**
 * Live active check. Unlike the schema's `isActive` boolean (baked at decode time),
 * this re-evaluates against the current clock so callers clear stale state at expiry.
 */
export const isTraceFlagActive = (item: TraceFlagItem): boolean => item.expirationDate.getTime() > Date.now();
