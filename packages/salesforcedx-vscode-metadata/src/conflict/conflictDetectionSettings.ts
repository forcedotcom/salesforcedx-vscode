/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';

/**
 * Centralized helper to check if conflict detection should be enabled.
 *
 * Returns true if conflict detection should run (default behavior).
 * Returns false if the user has disabled conflict detection via settings.
 *
 * This is the single source of truth for all conflict detection checks across:
 * - Status bar (startup, polling, file changes)
 * - Deploy commands
 * - Retrieve commands
 * - After metadata operations
 */
export const isConflictDetectionEnabled = Effect.fn('isConflictDetectionEnabled')(function* () {
  const config = vscode.workspace.getConfiguration('salesforcedx-vscode-metadata');
  const enabled = config.get<boolean>('sourceTracking.enableConflictDetection', true);

  yield* Effect.annotateCurrentSpan({
    'conflictDetection.enabled': enabled
  });

  return enabled;
});

/**
 * Synchronous version for non-Effect contexts.
 */
export const isConflictDetectionEnabledSync = (): boolean => {
  const config = vscode.workspace.getConfiguration('salesforcedx-vscode-metadata');
  return config.get<boolean>('sourceTracking.enableConflictDetection', true);
};
