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
import {
  ContinueResponse,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import {
  DeployStatus,
  RegistryAccess,
  SourceDeployResult,
  ToolingDeployStatus
} from '@salesforce/source-deploy-retrieve';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { handleDeployRetrieveLibraryDiagnostics } from '../diagnostics';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { DeployQueue } from '../settings';
import { SfdxProjectConfig } from '../sfdxProject';
import { telemetryService } from '../telemetry';
import { BaseDeployExecutor, DeployType } from './baseDeployCommand';
import { SourcePathChecker } from './forceSourceRetrieveSourcePath';
import {
  DeployRetrieveLibraryExecutor,
  FilePathGatherer,
  SfdxCommandlet,
  SfdxWorkspaceChecker
} from './util';
import {
  createComponentCount,
  useBetaDeployRetrieve
} from './util/betaDeployRetrieve';
import { LibraryDeployResultParser } from './util/libraryDeployResultParser';
export class ForceSourceDeploySourcePathExecutor extends BaseDeployExecutor {
  public build(sourcePath: string): Command {
    const commandBuilder = new SfdxCommandBuilder()
      .withDescription(nls.localize('force_source_deploy_text'))
      .withArg('force:source:deploy')
      .withLogName('force_source_deploy_with_sourcepath')
      .withFlag('--sourcepath', sourcePath)
      .withJson();
    return commandBuilder.build();
  }

  protected getDeployType() {
    return DeployType.Deploy;
  }
}

export class MultipleSourcePathsGatherer implements ParametersGatherer<string> {
  private uris: vscode.Uri[];
  public constructor(uris: vscode.Uri[]) {
    this.uris = uris;
  }
  public async gather(): Promise<ContinueResponse<string>> {
    const sourcePaths = this.uris.map(uri => uri.fsPath).join(',');
    return {
      type: 'CONTINUE',
      data: sourcePaths
    };
  }
}

export async function forceSourceDeploySourcePath(sourceUri: vscode.Uri) {
  if (!sourceUri) {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.languageId !== 'forcesourcemanifest') {
      sourceUri = editor.document.uri;
    } else {
      const errorMessage = nls.localize(
        'force_source_deploy_select_file_or_directory'
      );
      telemetryService.sendException(
        'force_source_deploy_with_sourcepath',
        errorMessage
      );
      notificationService.showErrorMessage(errorMessage);
      channelService.appendLine(errorMessage);
      channelService.showChannelOutput();
      return;
    }
  }
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new FilePathGatherer(sourceUri),
    useBetaDeployRetrieve([sourceUri])
      ? new LibraryDeploySourcePathExecutor()
      : new ForceSourceDeploySourcePathExecutor(),
    new SourcePathChecker()
  );
  await commandlet.run();
}

export async function forceSourceDeployMultipleSourcePaths(uris: vscode.Uri[]) {
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new MultipleSourcePathsGatherer(uris),
    useBetaDeployRetrieve(uris)
      ? new LibraryDeploySourcePathExecutor()
      : new ForceSourceDeploySourcePathExecutor()
  );
  await commandlet.run();
}

export class LibraryDeploySourcePathExecutor extends DeployRetrieveLibraryExecutor {
  public async execute(response: ContinueResponse<string>): Promise<void> {
    this.setStartTime();

    try {
      await this.build(
        'Deploy (Beta)',
        'force_source_deploy_with_sourcepath_beta'
      );
      channelService.showCommandWithTimestamp(`Starting ${this.executionName}`);
      if (this.sourceClient === undefined) {
        throw new Error('SourceClient is not established');
      }
      const projectNamespace = (await SfdxProjectConfig.getValue(
        'namespace'
      )) as string;
      const registryAccess = new RegistryAccess();
      const components = registryAccess.getComponentsFromPath(response.data);
      let deployPromise: Promise<SourceDeployResult>;
      if (projectNamespace) {
        deployPromise = this.sourceClient.tooling.deploy(components, {
          namespace: projectNamespace
        }) as Promise<SourceDeployResult>;
      } else {
        deployPromise = this.sourceClient.metadata.deploy(
          components
        ) as Promise<SourceDeployResult>;
      }
      const metadataCount = JSON.stringify(createComponentCount(components));
      const result = (await vscode.window.withProgress(
        {
          title: this.executionName,
          location: vscode.ProgressLocation.Notification
        },
        () => deployPromise
      )) as SourceDeployResult;
      const parser = new LibraryDeployResultParser(result);
      const outputResult = parser.resultParser(result);
      this.logMetric({ metadataCount });
      channelService.appendLine(outputResult);
      channelService.showCommandWithTimestamp(`Finished ${this.executionName}`);
      if (
        result.status === DeployStatus.Succeeded ||
        result.status === ToolingDeployStatus.Completed
      ) {
        DeployRetrieveLibraryExecutor.errorCollection.clear();
        notificationService
          .showSuccessfulExecution(this.executionName)
          .catch(error => {});
      } else {
        handleDeployRetrieveLibraryDiagnostics(
          result,
          DeployRetrieveLibraryExecutor.errorCollection
        );
        notificationService.showFailedExecution(this.executionName);
      }
    } catch (e) {
      telemetryService.sendException(
        'force_source_deploy_with_sourcepath_beta',
        e.message
      );
      notificationService.showFailedExecution(this.executionName);
      channelService.appendLine(e.message);
    } finally {
      await DeployQueue.get().unlock();
    }
  }
}
