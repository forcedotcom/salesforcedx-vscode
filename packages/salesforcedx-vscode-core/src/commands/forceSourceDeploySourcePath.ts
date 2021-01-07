/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection } from '@salesforce/core';
import {
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  ContinueResponse,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import {
  ComponentSet,
  DeployStatus,
  SourceClient,
  SourceDeployResult,
  ToolingDeployStatus
} from '@salesforce/source-deploy-retrieve';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { workspaceContext } from '../context';
import { handleDeployRetrieveLibraryDiagnostics } from '../diagnostics';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { DeployQueue } from '../settings';
import { SfdxPackageDirectories, SfdxProjectConfig } from '../sfdxProject';
import { telemetryService } from '../telemetry';
import { BaseDeployExecutor, DeployType } from './baseDeployCommand';
import { SourcePathChecker } from './forceSourceRetrieveSourcePath';
import {
  FilePathGatherer,
  LibraryCommandletExecutor,
  SfdxCommandlet,
  SfdxWorkspaceChecker
} from './util';
import {
  createComponentCount,
  createDeployOutput,
  useBetaDeployRetrieve
} from './util';

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

export class LibraryPathsGatherer implements ParametersGatherer<string[]> {
  private uris: vscode.Uri[];
  public constructor(uris: vscode.Uri[]) {
    this.uris = uris;
  }
  public async gather(): Promise<ContinueResponse<string[]>> {
    const sourcePaths = this.uris.map(uri => uri.fsPath);
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
  const useBeta = useBetaDeployRetrieve(uris);
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    useBeta
      ? new LibraryPathsGatherer(uris)
      : new MultipleSourcePathsGatherer(uris),
    useBeta
      ? new LibraryDeploySourcePathExecutor()
      : new ForceSourceDeploySourcePathExecutor()
  );
  await commandlet.run();
}

export class LibraryDeploySourcePathExecutor extends LibraryCommandletExecutor<
  string | string[]
> {
  protected executionName = 'Deploy (Beta)';
  protected logName = 'force_source_deploy_with_sourcepath_beta';

  public async run(
    response: ContinueResponse<string | string[]>
  ): Promise<boolean> {
    try {
      const getConnection = workspaceContext.getConnection();
      const components = this.getComponents(response.data);
      const namespace = (await SfdxProjectConfig.getValue(
        'namespace'
      )) as string;

      const deploy = this.doDeploy(await getConnection, components, namespace);
      const metadataCount = JSON.stringify(createComponentCount(components));
      this.telemetry.addProperty('metadataCount', metadataCount);

      const result = await deploy;

      const outputResult = createDeployOutput(
        result,
        await SfdxPackageDirectories.getPackageDirectoryPaths()
      );
      channelService.appendLine(outputResult);
      BaseDeployExecutor.errorCollection.clear();
      if (
        result.status === DeployStatus.Succeeded ||
        result.status === ToolingDeployStatus.Completed
      ) {
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

  private getComponents(paths: string | string[]): ComponentSet {
    const components = new ComponentSet();
    if (typeof paths === 'string') {
      components.resolveSourceComponents(paths);
    } else {
      for (const filepath of paths) {
        components.resolveSourceComponents(filepath);
      }
    }
    return components;
  }

  private doDeploy(
    connection: Connection,
    components: ComponentSet,
    namespace?: string
  ): Promise<SourceDeployResult> {
    let api: string;
    let deploy: Promise<SourceDeployResult>;

    if (namespace) {
      const client = new SourceClient(connection);
      deploy = client.tooling.deploy(
        components.getSourceComponents().next().value,
        {
          namespace
        }
      );
      api = 'tooling';
    } else {
      deploy = components.deploy(connection);
      api = 'metadata';
    }

    this.telemetry.addProperty('api', api);

    return deploy;
  }
}
