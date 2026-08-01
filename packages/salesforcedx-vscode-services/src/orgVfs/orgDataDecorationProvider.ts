/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import type { URI } from 'vscode-uri';
import { nls } from '../messages';
import { ORG_DATA_SCHEME } from './orgDataUris';

export class OrgDataDecorationProvider implements vscode.FileDecorationProvider {
  private readonly emitter = new vscode.EventEmitter<URI | URI[] | undefined>();
  public readonly onDidChangeFileDecorations = this.emitter.event;

  // eslint-disable-next-line class-methods-use-this
  public provideFileDecoration(uri: URI): vscode.ProviderResult<vscode.FileDecoration> {
    return uri.scheme === ORG_DATA_SCHEME
      ? {
          badge: nls.localize('org_data_vfs_org_badge_text'),
          tooltip: nls.localize('org_data_vfs_org_file_tooltip_text'),
          color: new vscode.ThemeColor('descriptionForeground')
        }
      : undefined;
  }
}
