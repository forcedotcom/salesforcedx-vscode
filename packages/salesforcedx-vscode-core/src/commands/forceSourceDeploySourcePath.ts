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
import { RegistryAccess } from '@salesforce/source-deploy-retrieve';
import {
  RegistryAccess,
  registryData, SourceClient
} from '@salesforce/source-deploy-retrieve';
import * as path from 'path';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { DeployQueue } from '../settings';
import { SfdxProjectConfig } from '../sfdxProject';
import { telemetryService } from '../telemetry';
import { BaseDeployExecutor, DeployType } from './baseDeployCommand';
import { SourcePathChecker } from './forceSourceRetrieveSourcePath';
import { FilePathGatherer, SfdxCommandlet, SfdxWorkspaceChecker } from './util';
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
import { LibraryCommandletExecutor } from './util/libraryCommandlet';
import { useBetaDeployRetrieve } from './util/useBetaDeployRetrieve';

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

// this supported types logic is temporary until we have a way of generating the metadata type from the path
// once we have the metadata type we can check to see if it is a toolingsupportedtype from that util
export function useBetaRetrieve(explorerPath: vscode.Uri[]): boolean {
  if (explorerPath.length > 1) {
    return false;
  }
  const filePath = explorerPath[0].fsPath;
  const betaDeployRetrieve = sfdxCoreSettings.getBetaDeployRetrieve();
  const supportedType = true;
  /*path.extname(filePath) === APEX_CLASS_EXTENSION ||
    filePath.includes(`${APEX_CLASS_EXTENSION}-meta.xml`) ||
    (path.extname(filePath) === APEX_TRIGGER_EXTENSION ||
      filePath.includes(`${APEX_TRIGGER_EXTENSION}-meta.xml`)) ||
    (path.extname(filePath) === VISUALFORCE_COMPONENT_EXTENSION ||
      filePath.includes(`${VISUALFORCE_COMPONENT_EXTENSION}-meta.xml`)) ||
    (path.extname(filePath) === VISUALFORCE_PAGE_EXTENSION ||
      filePath.includes(`${VISUALFORCE_PAGE_EXTENSION}-meta.xml`));*/
  return betaDeployRetrieve && supportedType;
}

export class LibraryDeploySourcePathExecutor extends DeployRetrieveLibraryExecutor {
  public async execute(response: ContinueResponse<string>): Promise<void> {
    this.setStartTime();

    try {
      await this.build(
        'Deploy (Beta)',
        'force_source_deploy_with_sourcepath_beta'
      );

      if (this.sourceClient === undefined) {
        throw new Error('SourceClient is not established');
      }

      this.sourceClient.tooling.deploy = this.deployWrapper(
        this.sourceClient.tooling.deploy
      );

      const projectNamespace = (await SfdxProjectConfig.getValue(
        'namespace'
      )) as string;
      const registryAccess = new RegistryAccess();
      const components = registryAccess.getComponentsFromPath(response.data);
      const deployPromise = this.sourceClient.tooling.deploy({
        components,
        namespace: projectNamespace
      });
      const metadataCount = JSON.stringify(createComponentCount(components));
      await deployPromise;

      this.logMetric({ metadataCount });
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
