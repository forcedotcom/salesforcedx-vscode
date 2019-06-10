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
import {
  CancelResponse,
  ContinueResponse,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as path from 'path';
import * as vscode from 'vscode';
import { nls } from '../messages';
import {
  getRootWorkspace,
  getRootWorkspacePath,
  hasRootWorkspace
} from '../util';
import {
  CompositeParametersGatherer,
  DevUsernameChecker,
  FileSelection,
  FileSelector,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './commands';

export const DEFAULT_ALIAS = 'vscodeScratchOrg';
export const DEFAULT_EXPIRATION_DAYS = '7';
export class ForceOrgCreateExecutor extends SfdxCommandletExecutor<
  AliasAndFileSelection
  > {
  public build(data: AliasAndFileSelection): Command {
    const selectionPath = path.relative(
      getRootWorkspacePath(), // this is safe because of workspaceChecker
      data.file
    );
    return new SfdxCommandBuilder()
      .withDescription(
        nls.localize('force_org_create_default_scratch_org_text')
      )
      .withArg('force:org:create')
      .withFlag('-f', `${selectionPath}`)
      .withFlag('--setalias', data.alias)
      .withFlag('--durationdays', data.expirationDays)
      .withArg('--setdefaultusername')
      .withLogName('force_org_create_default_scratch_org')
      .build();
  }
}

export class AliasGatherer implements ParametersGatherer<Alias> {
  public async gather(): Promise<CancelResponse | ContinueResponse<Alias>> {
    const defaultExpirationdate = DEFAULT_EXPIRATION_DAYS;
    let defaultAlias = DEFAULT_ALIAS;
    if (hasRootWorkspace()) {
      defaultAlias = getRootWorkspace().name.replace(
        /\W/g /* Replace all non-alphanumeric characters */,
        ''
      );
    }
    const aliasInputOptions = {
      prompt: nls.localize('parameter_gatherer_enter_alias_name'),
      placeHolder: defaultAlias
    } as vscode.InputBoxOptions;
    const alias = await vscode.window.showInputBox(aliasInputOptions);
    // Hitting enter with no alias will use the value of `defaultAlias`
    if (alias === undefined) {
      return { type: 'CANCEL' };
    }
    const expirationDays = {
      prompt: nls.localize(
        'parameter_gatherer_enter_scratch_org_expiration_days'
      ),
      value: defaultExpirationdate
    } as vscode.InputBoxOptions;
    let scratchOrgExpirationInDays = await vscode.window.showInputBox(
      expirationDays
    );
    if (
      scratchOrgExpirationInDays === undefined ||
      !Number.isSafeInteger(Number.parseInt(scratchOrgExpirationInDays))
    ) {
      return { type: 'CANCEL' };
    } else {
      if (
        Number.parseInt(scratchOrgExpirationInDays) < 1 ||
        Number.parseInt(scratchOrgExpirationInDays) > 30
      ) {
        scratchOrgExpirationInDays = DEFAULT_EXPIRATION_DAYS;
      } else {
        scratchOrgExpirationInDays = Number.parseInt(
          scratchOrgExpirationInDays
        ).toString();
      }
    }
    return {
      type: 'CONTINUE',
      data: {
        alias: alias === '' ? defaultAlias : alias,
        expirationDays: scratchOrgExpirationInDays
      }
    };
  }
}
export interface Alias {
  alias: string;
  expirationDays: string;
}

export type AliasAndFileSelection = Alias & FileSelection;

const devnamechecker = new DevUsernameChecker();
const parameterGatherer = new CompositeParametersGatherer(
  new FileSelector('config/**/*-scratch-def.json'),
  new AliasGatherer()
);

export async function forceOrgCreate() {
  const commandlet = new SfdxCommandlet(
    devnamechecker,
    parameterGatherer,
    new ForceOrgCreateExecutor()
  );
  await commandlet.run();
}
