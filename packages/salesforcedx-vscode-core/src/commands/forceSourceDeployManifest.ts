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
import * as vscode from 'vscode';
import { nls } from '../messages';
import { BaseDeployExecutor, DeployType } from './baseDeployCommand';
import {
  FilePathGatherer,
  SfdxCommandlet,
  SfdxWorkspaceChecker
} from './commands';

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

export async function forceSourceDeployManifest(manifestUri: vscode.Uri) {
  if (!manifestUri) {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      manifestUri = editor.document.uri;
    }
  }
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new FilePathGatherer(manifestUri),
    new ForceSourceDeployManifestExecutor()
  );
  await commandlet.run();
}
