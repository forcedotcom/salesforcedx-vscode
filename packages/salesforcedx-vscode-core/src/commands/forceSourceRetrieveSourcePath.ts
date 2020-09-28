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
import { PostconditionChecker } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import {
  CancelResponse,
  ContinueResponse
} from '@salesforce/salesforcedx-utils-vscode/out/src/types/index';
import {
  RegistryAccess,
  registryData,
  SourceClient
} from '@salesforce/source-deploy-retrieve';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { workspaceContext } from '../context';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { SfdxPackageDirectories, SfdxProjectConfig } from '../sfdxProject';
import { telemetryService } from '../telemetry';
import {
  createComponentCount,
  FilePathGatherer,
  LibraryCommandletExecutor,
  outputRetrieveTable,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker,
  useBetaDeployRetrieve
} from './util';

export class ForceSourceRetrieveSourcePathExecutor extends SfdxCommandletExecutor<
  string
> {
  public build(sourcePath: string): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_source_retrieve_text'))
      .withArg('force:source:retrieve')
      .withFlag('--sourcepath', sourcePath)
      .withLogName('force_source_retrieve_with_sourcepath')
      .build();
  }
}

export class SourcePathChecker implements PostconditionChecker<string> {
  public async check(
    inputs: ContinueResponse<string> | CancelResponse
  ): Promise<ContinueResponse<string> | CancelResponse> {
    if (inputs.type === 'CONTINUE') {
      const sourcePath = inputs.data;
      try {
        const isInSfdxPackageDirectory = await SfdxPackageDirectories.isInPackageDirectory(
          sourcePath
        );
        if (isInSfdxPackageDirectory) {
          return inputs;
        }
      } catch (error) {
        telemetryService.sendException(
          'force_source_retrieve_with_sourcepath',
          `Error while parsing package directories. ${error.message}`
        );
      }

      const errorMessage = nls.localize(
        'error_source_path_not_in_package_directory_text'
      );
      telemetryService.sendException(
        'force_source_retrieve_with_sourcepath',
        errorMessage
      );
      notificationService.showErrorMessage(errorMessage);
      channelService.appendLine(errorMessage);
      channelService.showChannelOutput();
    }
    return { type: 'CANCEL' };
  }
}

export async function forceSourceRetrieveSourcePath(explorerPath: vscode.Uri) {
  if (!explorerPath) {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.languageId !== 'forcesourcemanifest') {
      explorerPath = editor.document.uri;
    } else {
      const errorMessage = nls.localize(
        'force_source_retrieve_select_file_or_directory'
      );
      telemetryService.sendException(
        'force_source_retrieve_with_sourcepath',
        errorMessage
      );
      notificationService.showErrorMessage(errorMessage);
      channelService.appendLine(errorMessage);
      channelService.showChannelOutput();
      return;
    }
  }

  const { types } = registryData;
  const useBeta = useBetaDeployRetrieve(
    [explorerPath],
    [
      types.auradefinitionbundle,
      types.lightningcomponentbundle,
      types.apexclass,
      types.apexcomponent,
      types.apexpage,
      types.apextrigger
    ]
  );

  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new FilePathGatherer(explorerPath),
    useBeta
      ? new LibraryRetrieveSourcePathExecutor()
      : new ForceSourceRetrieveSourcePathExecutor(),
    new SourcePathChecker()
  );
  await commandlet.run();
}

export class LibraryRetrieveSourcePathExecutor extends LibraryCommandletExecutor<
  string
> {
  protected logName = 'force_source_retrieve_with_sourcepath_beta';
  protected executionName = 'Retrieve (Beta)';

  protected async run(response: ContinueResponse<string>): Promise<boolean> {
    const getConnection = workspaceContext.getConnection();
    const registryAccess = new RegistryAccess();
    const components = registryAccess.getComponentsFromPath(response.data);
    const projectNamespace = (await SfdxProjectConfig.getValue(
      'namespace'
    )) as string;
    const client = new SourceClient(await getConnection);
    const retrieve = client.tooling.retrieve({
      components,
      namespace: projectNamespace
    });
    const metadataCount = JSON.stringify(createComponentCount(components));
    this.telemetry.addProperty('metadataCount', metadataCount);

    const result = await retrieve;

    channelService.appendLine(outputRetrieveTable(result));

    return result.success;
  }
}
