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
import { PostconditionChecker } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import {
  CancelResponse,
  ContinueResponse
} from '@salesforce/salesforcedx-utils-vscode/out/src/types/index';
import {
  ComponentSet,
  MetadataResolver,
  MetadataType,
  registryData,
  RetrieveResult,
  ToolingApi
} from '@salesforce/source-deploy-retrieve';
import { RequestStatus } from '@salesforce/source-deploy-retrieve/lib/src/client/types';
import * as vscode from 'vscode';
import { channelService, OUTPUT_CHANNEL } from '../channels';
import { workspaceContext } from '../context';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { SfdxPackageDirectories, SfdxProjectConfig } from '../sfdxProject';
import { telemetryService } from '../telemetry';
import {
  createComponentCount,
  FilePathGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker,
  useBetaDeployRetrieve
} from './util';
import { createRetrieveOutput2 } from './util/sourceResultOutput';

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

  const useBeta = useBetaDeployRetrieve([explorerPath]);

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
  constructor() {
    super(
      'Retrieve (Beta)',
      'force_source_retrieve_with_sourcepath_beta',
      OUTPUT_CHANNEL
    );
  }

  public async run(response: ContinueResponse<string>): Promise<boolean> {
    let retrieve;
    const connection = await workspaceContext.getConnection();
    const components = ComponentSet.fromSource(response.data);
    const first = components.getSourceComponents().first();

    if (
      components.size === 1 &&
      first &&
      this.isSupportedToolingRetrieveType(first.type)
    ) {
      const projectNamespace = (await SfdxProjectConfig.getValue(
        'namespace'
      )) as string;
      const tooling = new ToolingApi(connection, new MetadataResolver());
      retrieve = tooling.retrieve({
        components,
        namespace: projectNamespace
      });
    } else {
      retrieve = components
        .retrieve({
          usernameOrConnection: connection,
          output: (await SfdxPackageDirectories.getDefaultPackageDir()) ?? '',
          merge: true
        })
        .start();
    }

    const metadataCount = JSON.stringify(createComponentCount(components));
    this.telemetry.addProperty('metadataCount', metadataCount);

    const result = await retrieve;

    if (result) {
      channelService.appendLine(
        createRetrieveOutput2(
          result,
          await SfdxPackageDirectories.getPackageDirectoryPaths()
        )
      );

      const status =
        result instanceof RetrieveResult
          ? result.response.status
          : result.status;

      return status === RequestStatus.Succeeded;
    }

    return false;
  }

  private isSupportedToolingRetrieveType(type: MetadataType): boolean {
    const { types } = registryData;
    const permittedTypeNames = [
      types.auradefinitionbundle.name,
      types.lightningcomponentbundle.name,
      types.apexclass.name,
      types.apexcomponent.name,
      types.apexpage.name,
      types.apextrigger.name
    ];
    return permittedTypeNames.includes(type.name);
  }
}
