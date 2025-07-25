/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { TimingUtils } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { BUILDER_VIEW_TYPE, OPEN_WITH_COMMAND } from '../constants';
import { telemetryService } from '../telemetry';

export const soqlOpenNew = async (): Promise<void> => {
  telemetryService.sendCommandEvent('soql_builder_open_new', TimingUtils.getCurrentTime());

  if (vscode.workspace) {
    const fileName = 'untitled.soql';
    const newUri = URI.file(fileName).with({
      scheme: 'untitled',
      path: fileName
    });

    // open with SOQL builder
    void vscode.commands.executeCommand(OPEN_WITH_COMMAND, newUri, BUILDER_VIEW_TYPE);
  }
};
