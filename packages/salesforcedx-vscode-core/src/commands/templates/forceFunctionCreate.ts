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
  isAlphaNumSpaceString
} from '@salesforce/salesforcedx-utils-vscode/out/src/helpers';
import {
  CancelResponse,
  ContinueResponse,
  FunctionInfo,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as vscode from 'vscode';
import {
  CompositeParametersGatherer,
  SelectFileName,
  SfdxCommandlet,
  SfdxWorkspaceChecker
} from '../util';
import { BaseTemplateCommand } from './baseTemplateCommand';
import { FUNCTION_TYPE } from './metadataTypeConstants';

export class ForceFunctionCreateExecutor extends BaseTemplateCommand {
  constructor() {
    super(FUNCTION_TYPE);
  }

  public build(data: FunctionInfo): Command {
    if (data.language === 'javascript') {
      this.setFileExtension('js');
    } else if (data.language === 'typescript') {
      this.setFileExtension('ts');
    }
    return new SfdxCommandBuilder()
      .withDescription(
        'Create Function...'
      )
      .withArg('evergreen:function:create')
      .withArg(data.fileName)
      .withFlag('--language', data.language)
      .withLogName('force_org_create_function')
      .build();
  }
}

export class FunctionInfoGatherer implements ParametersGatherer<FunctionInfo> {
  public async gather(): Promise<CancelResponse | ContinueResponse<FunctionInfo>> {
    const nameInputOptions = {
      prompt: 'Enter function name',
      validateInput: value => {
        return isAlphaNumSpaceString(value) || value === ''
          ? null
          : 'Only alphanumeric allowed';
      }
    } as vscode.InputBoxOptions;
    const name = await vscode.window.showInputBox(nameInputOptions);
    // Hitting enter with no alias will use the value of `defaultAlias`
    if (name === undefined) {
      return { type: 'CANCEL' };
    }

    const language = await vscode.window.showQuickPick(['javascript', 'typescript'], {
      placeHolder: 'Select language for your function'
    });

    if (language === undefined) {
      return { type: 'CANCEL' };
    }
    return {
      type: 'CONTINUE',
      data: {
        fileName: name,
        language,
        outputdir: ''
      }
    };
  }
}

const fileNameGatherer = new SelectFileName();

const parameterGatherer = new CompositeParametersGatherer(
  new FunctionInfoGatherer()
);

export async function forceFunctionCreate() {
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    parameterGatherer,
    new ForceFunctionCreateExecutor()
    // new OverwriteComponentPrompt()
  );
  await commandlet.run();
}
