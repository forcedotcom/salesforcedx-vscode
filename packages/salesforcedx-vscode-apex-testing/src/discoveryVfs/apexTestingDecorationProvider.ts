/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { APEX_TESTING_SCHEME } from './apexTestingDiscoveryFs';

export class ApexTestingDecorationProvider implements vscode.FileDecorationProvider {
  private readonly emitter = new vscode.EventEmitter<URI | URI[] | undefined>();
  public readonly onDidChangeFileDecorations = this.emitter.event;

  public provideFileDecoration(uri: URI): vscode.ProviderResult<vscode.FileDecoration> {
    if (uri.scheme !== APEX_TESTING_SCHEME) {
      return undefined;
    }

    return {
      badge: 'ORG',
      tooltip: 'Org virtual file (read-only)',
      color: new vscode.ThemeColor('descriptionForeground')
    };
  }
}

