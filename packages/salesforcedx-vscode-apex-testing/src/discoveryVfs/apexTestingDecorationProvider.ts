/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { nls } from '../messages';
import { APEX_TESTING_SCHEME } from './apexTestingDiscoveryFs';

export class ApexTestingDecorationProvider implements vscode.FileDecorationProvider {
  private readonly emitter = new vscode.EventEmitter<URI | URI[] | undefined>();
  public readonly onDidChangeFileDecorations = this.emitter.event;

  // eslint-disable-next-line class-methods-use-this
  public provideFileDecoration(uri: URI): vscode.ProviderResult<vscode.FileDecoration> {
    if (uri.scheme !== APEX_TESTING_SCHEME) {
      return undefined;
    }

    return {
      badge: nls.localize('apex_testing_vfs_org_badge_text'),
      tooltip: nls.localize('apex_testing_vfs_org_file_tooltip_text'),
      color: new vscode.ThemeColor('descriptionForeground')
    };
  }
}

