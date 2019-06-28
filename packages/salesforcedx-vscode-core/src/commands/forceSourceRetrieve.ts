/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';

import {
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { channelService } from '../channels';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { telemetryService } from '../telemetry';
import {
  EmptyParametersGatherer,
  FilePathGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './commands';

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
      .withDescription('SFDX: Retrieve Source from Org')
      .withArg('force:source:retrieve')
      .withFlag('-m', this.metadataArg)
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
    executor
  );
  await commandlet.run();
}
