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
  EmptyParametersGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './commands';
import { ForceAuthDemoModeExecutor } from './forceAuthWebLogin';

import { nls } from '../messages';
import { isDemoMode } from '../modes/demo-mode';

export class ForceAuthDevHubExecutor extends SfdxCommandletExecutor<{}> {
  public build(data: {}): Command {
    return new SfdxCommandBuilder()
      .withDescription(
        nls.localize('force_auth_web_login_authorize_dev_hub_text')
      )
      .withArg('force:auth:web:login')
      .withArg('--setdefaultdevhubusername')
      .build();
  }
}

export class ForceAuthDevHubDemoModeExecutor extends ForceAuthDemoModeExecutor<{}> {
  public build(data: {}): Command {
    return new SfdxCommandBuilder()
      .withDescription(
        nls.localize('force_auth_web_login_authorize_dev_hub_text')
      )
      .withArg('force:auth:web:login')
      .withArg('--setdefaultdevhubusername')
      .withArg('--noprompt')
      .withJson()
      .build();
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new EmptyParametersGatherer();

export function createExecutor(): SfdxCommandletExecutor<{}> {
  return isDemoMode()
    ? new ForceAuthDevHubDemoModeExecutor()
    : new ForceAuthDevHubExecutor();
}

export async function forceAuthDevHub() {
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    createExecutor()
  );
  await commandlet.run();
}
