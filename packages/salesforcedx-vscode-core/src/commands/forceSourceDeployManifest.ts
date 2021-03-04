/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { LibraryCommandletExecutor } from '@salesforce/salesforcedx-utils-vscode/out/src';
import {
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/src/types';
import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import { RequestStatus } from '@salesforce/source-deploy-retrieve/lib/src/client/types';
import { join } from 'path';
import * as vscode from 'vscode';
import { channelService, OUTPUT_CHANNEL } from '../channels';
import {
  ConflictDetectionChecker,
  ConflictDetectionMessages
} from '../commands/util/postconditionCheckers';
import { workspaceContext } from '../context';
import { handleDeployDiagnostics } from '../diagnostics';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { DeployQueue } from '../settings';
import { SfdxPackageDirectories } from '../sfdxProject';
import { telemetryService } from '../telemetry';
import { getRootWorkspacePath } from '../util';
import { BaseDeployExecutor, DeployType } from './baseDeployCommand';
import {
  createComponentCount,
  FilePathGatherer,
  SfdxCommandlet,
  SfdxWorkspaceChecker,
  useBetaDeployRetrieve
} from './util';
import { createDeployOutput } from './util';
import { createDeployOutput2 } from './util/sourceResultOutput';

export class ForceSourceDeployManifestExecutor extends BaseDeployExecutor {
  public build(manifestPath: string): Command {
    const commandBuilder = new SfdxCommandBuilder()
      .withDescription(nls.localize('force_source_deploy_text'))
      .withArg('force:source:deploy')
      .withLogName('force_source_deploy_with_manifest')
      .withFlag('--manifest', manifestPath)
      .withJson();
    return commandBuilder.build();
  }

  protected getDeployType() {
    return DeployType.Deploy;
  }
}

export class LibrarySourceDeployManifestExecutor extends LibraryCommandletExecutor<
  string
> {
  constructor() {
    super(
      nls.localize('force_source_deploy_text'),
      'force_source_deploy_with_manifest_beta',
      OUTPUT_CHANNEL
    );
  }

  public async run(response: ContinueResponse<string>): Promise<boolean> {
    const packageDirs = await SfdxPackageDirectories.getPackageDirectoryPaths();
    try {
      const components = await ComponentSet.fromManifestFile(response.data, {
        resolve: packageDirs.map(dir => join(getRootWorkspacePath(), dir))
      });
      const operation = components
        .deploy({
          usernameOrConnection: await workspaceContext.getConnection()
        })
        .start();

      this.telemetry.addProperty(
        'metadataCount',
        JSON.stringify(createComponentCount(components))
      );

      const result = await operation;

      if (result) {
        BaseDeployExecutor.errorCollection.clear();

        const outputResult = createDeployOutput2(result, packageDirs);
        channelService.appendLine(outputResult);

        const success = result.response.status === RequestStatus.Succeeded;

        if (!success) {
          handleDeployDiagnostics(result, BaseDeployExecutor.errorCollection);
        }

        return success;
      }

      return false;
    } finally {
      await DeployQueue.get().unlock();
    }
  }
}

export async function forceSourceDeployManifest(manifestUri: vscode.Uri) {
  if (!manifestUri) {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.languageId === 'forcesourcemanifest') {
      manifestUri = editor.document.uri;
    } else {
      const errorMessage = nls.localize('force_source_deploy_select_manifest');
      telemetryService.sendException(
        'force_source_deploy_with_manifest',
        errorMessage
      );
      notificationService.showErrorMessage(errorMessage);
      channelService.appendLine(errorMessage);
      channelService.showChannelOutput();
      return;
    }
  }

  const messages: ConflictDetectionMessages = {
    warningMessageKey: 'conflict_detect_conflicts_during_deploy',
    commandHint: input => {
      return new SfdxCommandBuilder()
        .withArg('force:source:deploy')
        .withFlag('--manifest', input)
        .build()
        .toString();
    }
  };

  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new FilePathGatherer(manifestUri),
    useBetaDeployRetrieve([])
      ? new LibrarySourceDeployManifestExecutor()
      : new ForceSourceDeployManifestExecutor(),
    new ConflictDetectionChecker(messages)
  );
  await commandlet.run();
}
