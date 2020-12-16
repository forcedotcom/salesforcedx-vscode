/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/src/types';
import { ComponentSet, DeployStatus } from '@salesforce/source-deploy-retrieve';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import {
  ConflictDetectionChecker,
  ConflictDetectionMessages
} from '../commands/util/postconditionCheckers';
import { workspaceContext } from '../context';
import { handleDeployRetrieveLibraryDiagnostics } from '../diagnostics';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { DeployQueue } from '../settings';
import { SfdxPackageDirectories } from '../sfdxProject';
import { telemetryService } from '../telemetry';
import { BaseDeployExecutor, DeployType } from './baseDeployCommand';
import { createComponentCount, FilePathGatherer, LibraryCommandletExecutor, LibraryDeployResultParser, SfdxCommandlet, SfdxWorkspaceChecker, useBetaDeployRetrieve } from './util';

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

export class LibrarySourceDeployManifestExecutor extends LibraryCommandletExecutor<string> {
  protected logName = 'force_source_deploy_with_manifest';
  protected executionName = 'Deploy With Manifest (beta)';

  protected async run(response: ContinueResponse<string>): Promise<boolean> {
    try {
      const components = await ComponentSet.fromManifestFile(response.data, {
        resolve: await SfdxPackageDirectories.getPackageDirectoryFullPaths()
      });
      const deployPromise = components.deploy(await workspaceContext.getConnection());
      this.telemetry.addProperty('metadataCount', JSON.stringify(createComponentCount(components)));
      const result = await deployPromise;

      const parser = new LibraryDeployResultParser(result);
      const outputResult = parser.resultParser(result);
      channelService.appendLine(outputResult);
      BaseDeployExecutor.errorCollection.clear();

      if (result.status === DeployStatus.Succeeded) {
        return true;
      }

      handleDeployRetrieveLibraryDiagnostics(
        result,
        BaseDeployExecutor.errorCollection
      );

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
