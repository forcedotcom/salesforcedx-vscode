/*
 * Copyright (c) 2017, salesforce.com, inc.
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

export class ForceAuthLogoutAll extends SfdxCommandletExecutor<{}> {
  public static withoutShowingChannel(): ForceAuthLogoutAll {
    const instance = new ForceAuthLogoutAll();
    instance.showChannelOutput = false;
    return instance;
  }

  public build(data: {}): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_auth_logout_all_text'))
      .withArg('force:auth:logout')
      .withArg('--all')
      .withArg('--noprompt')
      .build();
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new EmptyParametersGatherer();
const executor = new ForceAuthLogoutAll();
const commandlet = new SfdxCommandlet(
  workspaceChecker,
  parameterGatherer,
  executor
);

export async function forceAuthLogoutAll() {
  await commandlet.run();
}
