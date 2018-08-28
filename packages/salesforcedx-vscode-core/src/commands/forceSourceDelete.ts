/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'path';

import {
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  CancelResponse,
  ContinueResponse,
  ParametersGatherer,
  PreconditionChecker
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as vscode from 'vscode';
import { SfdxCommandlet, SfdxCommandletExecutor } from './commands';

import { nls } from '../messages';
import { notificationService } from '../notifications';

export class ForceSourceDeleteExecutor extends SfdxCommandletExecutor<{
  filePath: string;
}> {
  public build(data: { filePath: string }): Command {
    const commandBuilder = new SfdxCommandBuilder()
      .withDescription(nls.localize('force_source_delete_text'))
      .withArg('force:source:delete')
      .withLogName('force_source_delete')
      .withFlag('--sourcepath', data.filePath)
      .withArg('--noprompt');
    return commandBuilder.build();
  }
}

export class ManifestChecker implements PreconditionChecker {
  private explorerPath: string;

  public constructor(explorerPath: any) {
    this.explorerPath = explorerPath.fsPath;
  }

  public check(): boolean {
    if (
      vscode.workspace.workspaceFolders instanceof Array &&
      vscode.workspace.workspaceFolders.length > 0
    ) {
      const workspaceRootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const manifestPath = path.join(workspaceRootPath, 'manifest');
      const isManifestFile = this.explorerPath.includes(manifestPath);
      if (isManifestFile) {
        notificationService.showErrorMessage(
          nls.localize('force_source_delete_manifest_unsupported_message')
        );
        return false;
      }
      return true;
    }
    return false;
  }
}

export class ConfirmationAndSourcePathGatherer
  implements ParametersGatherer<{ filePath: string }> {
  private explorerPath: string;
  private readonly PROCEED = 'Delete source';
  private readonly CANCEL = 'Cancel';

  public constructor(explorerPath: any) {
    this.explorerPath = explorerPath.fsPath;
  }

  public async gather(): Promise<
    CancelResponse | ContinueResponse<{ filePath: string }>
  > {
    const prompt = nls.localize('force_source_delete_confirmation_message');
    const response = await vscode.window.showInformationMessage(
      prompt,
      this.PROCEED,
      this.CANCEL
    );

    return response && response === this.PROCEED
      ? { type: 'CONTINUE', data: { filePath: this.explorerPath } }
      : { type: 'CANCEL' };
  }
}

export async function forceSourceDelete(explorerPath: any) {
  const manifestChecker = new ManifestChecker(explorerPath);
  const commandlet = new SfdxCommandlet(
    manifestChecker,
    new ConfirmationAndSourcePathGatherer(explorerPath),
    new ForceSourceDeleteExecutor()
  );
  await commandlet.run();
}
