/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { nls } from '../messages';
import {
  EmptyParametersGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './commands';
import {
  BaseTemplateCommand,
  DefaultPathStrategy,
  FilePathExistsChecker
} from './templates/baseTemplateCommand';

export class ForceSourceRetrieveExecutor extends SfdxCommandletExecutor<
  string
> {
  private metadataArg: string;
  constructor(metadataArg: string) {
    super();
    this.metadataArg = metadataArg;
  }

  public build(): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_source_retrieve_text'))
      .withArg('force:source:retrieve')
      .withFlag('-m', this.metadataArg)
      .withLogName('force_source_retrieve')
      .build();
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new EmptyParametersGatherer();

export async function forceSourceRetrieve(metadataArg: string) {
  const executor = new ForceSourceRetrieveExecutor(metadataArg);
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    executor,
    new FilePathExistsChecker(['.cls'], new DefaultPathStrategy(), metadataArg)
  );
  await commandlet.run();
}
