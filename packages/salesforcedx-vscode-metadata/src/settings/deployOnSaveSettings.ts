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
  CORE_PUSH_OR_DEPLOY_ON_SAVE_ENABLED,
  CORE_PUSH_OR_DEPLOY_ON_SAVE_IGNORE_CONFLICTS,
  DEPLOY_ON_SAVE_ENABLED,
  DEPLOY_ON_SAVE_IGNORE_CONFLICTS,
  METADATA_CONFIG_SECTION
} from '../constants';

/** Get explicit value from inspect result, respecting VS Code precedence (folder > workspace > global) */
const getExplicitValue = (
  inspect: { workspaceFolderValue?: boolean; workspaceValue?: boolean; globalValue?: boolean } | undefined
): boolean | undefined => inspect?.workspaceFolderValue ?? inspect?.workspaceValue ?? inspect?.globalValue;

/** Check if deploy on save is enabled, respecting both core and metadata extension settings */
export const getDeployOnSaveEnabled = Effect.fn('getDeployOnSaveEnabled')(function* () {
  // Check vscode-core setting first
  const coreConfig = vscode.workspace.getConfiguration(CORE_CONFIG_SECTION);
  const coreInspect = coreConfig.inspect<boolean>(CORE_PUSH_OR_DEPLOY_ON_SAVE_ENABLED);
  const coreValue = getExplicitValue(coreInspect);
  if (coreValue !== undefined) {
    yield* Effect.annotateCurrentSpan({ coreValue });
    return coreValue;
  }
  // Check metadata extension setting
  const metadataConfig = vscode.workspace.getConfiguration(METADATA_CONFIG_SECTION);
  const metadataInspect = metadataConfig.inspect<boolean>(DEPLOY_ON_SAVE_ENABLED);
  const metadataValue = getExplicitValue(metadataInspect);
  if (metadataValue !== undefined) {
    yield* Effect.annotateCurrentSpan({ metadataValue });
    return metadataValue;
  }

  yield* Effect.logInfo('No value found from any extension, returning false');
  return false;
});

/** Check if conflicts should be ignored during deploy on save */
export const getIgnoreConflicts = (): boolean => {
  // Check vscode-core setting first
  const coreConfig = vscode.workspace.getConfiguration(CORE_CONFIG_SECTION);
  const coreSetting = coreConfig.get<boolean>(CORE_PUSH_OR_DEPLOY_ON_SAVE_IGNORE_CONFLICTS);
  if (coreSetting !== undefined) return coreSetting;

  // Fall back to metadata extension setting
  const metadataConfig = vscode.workspace.getConfiguration(METADATA_CONFIG_SECTION);
  return metadataConfig.get<boolean>(DEPLOY_ON_SAVE_IGNORE_CONFLICTS, true);
};
