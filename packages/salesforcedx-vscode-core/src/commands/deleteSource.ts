/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Command, SfCommandBuilder } from '@salesforce/salesforcedx-utils';
import {
  workspaceUtils,
  fileUtils,
  CancelResponse,
  ContinueResponse,
  ParametersGatherer,
  PreconditionChecker
} from '@salesforce/salesforcedx-utils-vscode';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { OrgType, workspaceContextUtils } from '../context';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { getUriFromActiveEditor } from './util/getUriFromActiveEditor';
import { SfCommandlet } from './util/sfCommandlet';
import { SfCommandletExecutor } from './util/sfCommandletExecutor';

export class DeleteSourceExecutor extends SfCommandletExecutor<{
  filePath: string;
}> {
  private isSourceTracked: boolean;

  constructor(isSourceTracked: boolean) {
    super();
    this.isSourceTracked = isSourceTracked;
  }
  public build(data: { filePath: string }): Command {
    const commandBuilder = new SfCommandBuilder()
      .withDescription(nls.localize('delete_source_text'))
      .withArg('project:delete:source')
      .withLogName('project_delete_source')
      .withFlag('--source-dir', data.filePath)
      .withArg('--no-prompt');
    if (this.isSourceTracked) {
      commandBuilder.args.push('--track-source');
    }
    return commandBuilder.build();
  }
}

class ManifestChecker implements PreconditionChecker {
  private explorerPath: string;

  constructor(uri: URI) {
    this.explorerPath = fileUtils.flushFilePath(uri.fsPath);
  }

  public check(): boolean {
    if (workspaceUtils.hasRootWorkspace()) {
      const workspaceRootPath = workspaceUtils.getRootWorkspacePath();
      const manifestPath = path.join(workspaceRootPath, 'manifest');
      const isManifestFile = this.explorerPath.includes(manifestPath);
      if (isManifestFile) {
        notificationService.showErrorMessage(nls.localize('delete_source_manifest_unsupported_message'));
        return false;
      }
      return true;
    }
    return false;
  }
}

class ConfirmationAndSourcePathGatherer implements ParametersGatherer<{ filePath: string }> {
  private explorerPath: string;
  private readonly PROCEED = nls.localize('confirm_delete_source_button_text');
  private readonly CANCEL = nls.localize('cancel_delete_source_button_text');

  constructor(uri: URI) {
    this.explorerPath = fileUtils.flushFilePath(uri.fsPath);
  }

  public async gather(): Promise<CancelResponse | ContinueResponse<{ filePath: string }>> {
    const prompt = nls.localize('delete_source_confirmation_message');
    const response = await vscode.window.showInformationMessage(prompt, this.PROCEED, this.CANCEL);

    return response && response === this.PROCEED
      ? { type: 'CONTINUE', data: { filePath: this.explorerPath } }
      : { type: 'CANCEL' };
  }
}

export const deleteSource = async (sourceUri: URI) => {
  let isSourceTracked: boolean = false;
  const orgType = await workspaceContextUtils.getWorkspaceOrgType();
  if (orgType === OrgType.SourceTracked) {
    isSourceTracked = true;
  }
  const resolved =
    sourceUri ??
    (await getUriFromActiveEditor({
      message: 'delete_source_select_file_or_directory',
      exceptionKey: 'project_delete_source'
    }));
  if (!resolved) {
    return;
  }
  const manifestChecker = new ManifestChecker(sourceUri);
  const commandlet = new SfCommandlet(
    manifestChecker,
    new ConfirmationAndSourcePathGatherer(sourceUri),
    new DeleteSourceExecutor(isSourceTracked)
  );
  await commandlet.run();
};
