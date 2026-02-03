/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import {
  CORE_CONFIG_SECTION,
  DEPLOY_ON_SAVE_ENABLED,
  DEPLOY_ON_SAVE_IGNORE_CONFLICTS
} from '../constants';

/** Check if deploy on save is enabled */
export const getDeployOnSaveEnabled = Effect.fn('getDeployOnSaveEnabled')(function* () {
  const config = vscode.workspace.getConfiguration(CORE_CONFIG_SECTION);
  return config.get<boolean>(DEPLOY_ON_SAVE_ENABLED, false);
});

/** Check if conflicts should be ignored during deploy on save */
export const getIgnoreConflicts = (): boolean => {
  const config = vscode.workspace.getConfiguration(CORE_CONFIG_SECTION);
  return config.get<boolean>(DEPLOY_ON_SAVE_IGNORE_CONFLICTS, false);
};
