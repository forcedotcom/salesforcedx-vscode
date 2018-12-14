import {
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  ContinueResponse,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as vscode from 'vscode';
import { nls } from '../messages';
import {
  FilePathGatherer,
  SfdxCommandlet,
  SfdxWorkspaceChecker
} from './commands';
import { ForceSourceDeployExecutor } from './forceSourceDeploy';
import { SourcePathChecker } from './forceSourceRetrieveSourcePath';

export class ForceSourceDeploySourcePathExecutor extends ForceSourceDeployExecutor {
  public build(sourcePath: string): Command {
    const commandBuilder = new SfdxCommandBuilder()
      .withDescription(nls.localize('force_source_deploy_text'))
      .withArg('force:source:deploy')
      .withLogName('force_source_deploy')
      .withFlag('--sourcepath', sourcePath)
      .withJson();
    return commandBuilder.build();
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
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new FilePathGatherer(sourceUri),
    new ForceSourceDeploySourcePathExecutor(),
    new SourcePathChecker()
  );
  await commandlet.run();
}

export async function forceSourceDeployMultipleSourcePaths(uris: vscode.Uri[]) {
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new MultipleSourcePathsGatherer(uris),
    new ForceSourceDeploySourcePathExecutor()
  );
  await commandlet.run();
}
