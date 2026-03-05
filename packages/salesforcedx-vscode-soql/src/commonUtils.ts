/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { Utils } from 'vscode-uri';
import { channelService } from './services/channel';
import { telemetryService } from './telemetry';

export const getDocumentName = (document: vscode.TextDocument): string =>
  Utils.basename(document.uri) || '';

export const trackErrorWithTelemetry = (problemId: string, error: string): void => {
  try {
    try {
      telemetryService.sendException(`soql_error_${problemId.toLocaleLowerCase()}`, error);
    } catch {
      channelService.appendLine(`soql_error_telemetry:  ${error.toString()}`);
    }
  } catch (err) {
    console.error(err);
  }
};
