/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';
import * as vscode from 'vscode';
import { channelService } from './sf';
import { telemetryService } from './telemetry';

export const getDocumentName = (document: vscode.TextDocument): string => {
  const documentPath = document.uri.fsPath;
  return path.basename(documentPath) || '';
};

export const trackErrorWithTelemetry = (problemId: string, error: string): Promise<void> => {
  try {
    telemetryService.sendException(`soql_error_${problemId.toLocaleLowerCase()}`, error);
  } catch (err) {
    channelService.appendLine(`soql_error_telemetry:  ${error.toString()}`);
  }
  return Promise.resolve();
};
