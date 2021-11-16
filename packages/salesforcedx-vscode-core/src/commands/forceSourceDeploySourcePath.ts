/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  ContinueResponse
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { SfdxProjectConfig } from '../sfdxProject';
import { DeployExecutor } from './baseDeployRetrieve';
import {
  LibraryPathsGatherer,
  SfdxCommandlet,
  SfdxWorkspaceChecker
} from './util';
import {
  ConflictDetectionMessages,
  TimestampConflictChecker
} from './util/postconditionCheckers';

export class LibraryDeploySourcePathExecutor extends DeployExecutor<
  string[]
> {
  constructor() {
    super(
      nls.localize('force_source_deploy_text'),
      'force_source_deploy_with_sourcepath_beta'
    );
  }

  public async getComponents(
    response: ContinueResponse<string[]>
  ): Promise<ComponentSet> {
    const sourceApiVersion = (await SfdxProjectConfig.getValue('sourceApiVersion')) as string;
    const paths = typeof response.data === 'string' ? [response.data] : response.data;
    const componentSet = ComponentSet.fromSource(paths);
    componentSet.sourceApiVersion = sourceApiVersion;
    return componentSet;
  }
}

export const forceSourceDeploySourcePaths = async (
  sourceUri: vscode.Uri,
  uris: vscode.Uri[] | undefined
) => {
  // When a single file is selected and "Deploy Source from Org" is executed,
  // sourceUri is passed, and the uris array contains a single element, the same
  // path as sourceUri.
  //
  // When multiple files are selected and "Deploy Source from Org" is executed,
  // sourceUri is passed, and is the path to the first selected file, and the uris
  // array contains an array of all paths that were selected.
  //
  // When editing a file and "Deploy This Source from Org" is executed,
  // sourceUri is passed, but uris is undefined.
  if (!uris || uris.length < 1) {
    uris = [];
    uris.push(sourceUri);
  }

  const messages: ConflictDetectionMessages = {
    warningMessageKey: 'conflict_detect_conflicts_during_deploy',
    commandHint: inputs => {
      const commands: string[] = [];
      (inputs as string[]).forEach(input => {
        commands.push(
          new SfdxCommandBuilder()
            .withArg('force:source:deploy')
            .withFlag('--sourcepath', input)
            .build()
            .toString()
        );
      });
      const hints = commands.join('\n  ');

      return hints;
    }
  };

  const commandlet = new SfdxCommandlet<string[]>(
    new SfdxWorkspaceChecker(),
    new LibraryPathsGatherer(uris),
    new LibraryDeploySourcePathExecutor(),
    new TimestampConflictChecker(false, messages)
  );

  await commandlet.run();
};
