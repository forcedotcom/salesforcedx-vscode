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
import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { sfdxCoreSettings } from '../settings';
import { SfdxProjectConfig } from '../sfdxProject';
import { telemetryService } from '../telemetry';
import { BaseDeployExecutor, DeployType } from './baseDeployCommand';
import { DeployExecutor } from './baseDeployRetrieve';
import { SourcePathChecker } from './forceSourceRetrieveSourcePath';
import { FilePathGatherer, SfdxCommandlet, SfdxWorkspaceChecker } from './util';
import {
  CompositePostconditionChecker,
  ConflictDetectionMessages,
  TimestampConflictChecker
} from './util/postconditionCheckers';

export class LibraryDeploySourcePathExecutor extends DeployExecutor<
  string | string[]
> {
  constructor() {
    super(
      nls.localize('force_source_deploy_text'),
      'force_source_deploy_with_sourcepath_beta'
    );
  }

  public async getComponents(
    response: ContinueResponse<string | string[]>
  ): Promise<ComponentSet> {
    const sourceApiVersion = (await SfdxProjectConfig.getValue('sourceApiVersion')) as string;
    const paths = typeof response.data === 'string' ? [response.data] : response.data;
    const componentSet = ComponentSet.fromSource(paths);
    componentSet.sourceApiVersion = sourceApiVersion;
    return componentSet;
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

  const messages: ConflictDetectionMessages = {
    warningMessageKey: 'conflict_detect_conflicts_during_deploy',
    commandHint: input => {
      return new SfdxCommandBuilder()
        .withArg('force:source:deploy')
        .withFlag('--sourcepath', input)
        .build()
        .toString();
    }
  };

  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new FilePathGatherer(sourceUri),
    new LibraryDeploySourcePathExecutor(),
    new CompositePostconditionChecker(
      new SourcePathChecker(),
      new TimestampConflictChecker(false, messages)
    )
  );
  await commandlet.run();
}

export async function forceSourceDeployMultipleSourcePaths(uris: vscode.Uri[]) {
  const messages: ConflictDetectionMessages = {
    warningMessageKey: 'conflict_detect_conflicts_during_deploy',
    commandHint: input => {
      return new SfdxCommandBuilder()
        .withArg('force:source:deploy')
        .withFlag('--sourcepath', input)
        .build()
        .toString();
    }
  };
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new LibraryPathsGatherer(uris),
    new LibraryDeploySourcePathExecutor(),
    new TimestampConflictChecker(false, messages)
  );
  await commandlet.run();
}
