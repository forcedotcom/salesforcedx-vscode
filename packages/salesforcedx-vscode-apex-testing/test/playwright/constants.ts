/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
export const TEST_RUN_TIMEOUT = 600_000;

// Code-coverage colorizer (codeCoverageColorizer.headless.spec.ts):
// Theme is pinned so testing.coveredBackground / testing.uncoveredBackground resolve to fixed
// RGBA across CI + local. "Dark 2026" is the harness workspace default and matches the exact
// Settings UI combobox option label. RGBA values were captured from the rendered .view-overlays
// decorations under this theme (Phase 1 spike). Re-capture if the pinned theme changes.
export const PINNED_THEME = 'Dark 2026';
export const COVERED_BG_RGBA = 'rgba(87, 171, 90, 0.3)';
export const UNCOVERED_BG_RGBA = 'rgba(244, 112, 103, 0.3)';
