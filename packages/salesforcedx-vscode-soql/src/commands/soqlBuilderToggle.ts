/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { TimingUtils } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { BUILDER_VIEW_TYPE, EDITOR_VIEW_TYPE, OPEN_WITH_COMMAND } from '../constants';
import { telemetryService } from '../telemetry';

export const soqlBuilderToggle = (doc: URI): Promise<void> => {
  telemetryService.sendCommandEvent('soql_builder_toggle', TimingUtils.getCurrentTime());

  const viewType = vscode.window.activeTextEditor ? BUILDER_VIEW_TYPE : EDITOR_VIEW_TYPE;

  void vscode.commands.executeCommand(OPEN_WITH_COMMAND, doc, viewType);
  return Promise.resolve();
};
