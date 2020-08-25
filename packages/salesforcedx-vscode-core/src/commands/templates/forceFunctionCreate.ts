/*
 * Copyright (c) 2020, salesforce.com, inc.
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
  FunctionInfo,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as vscode from 'vscode';
import { nls } from '../../messages';
import {
  CompositeParametersGatherer,
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
      .withDescription(nls.localize('force_function_create_text'))
      .withArg('evergreen:function:create')
      .withArg(data.fileName)
      .withFlag('--language', data.language)
      .withLogName('force_create_function')
      .build();
  }
}

export class FunctionInfoGatherer implements ParametersGatherer<FunctionInfo> {
  public async gather(): Promise<CancelResponse | ContinueResponse<FunctionInfo>> {
    const nameInputOptions = {
      prompt: nls.localize('force_function_enter_function')
    } as vscode.InputBoxOptions;
    const name = await vscode.window.showInputBox(nameInputOptions);
    if (name === undefined) {
      return { type: 'CANCEL' };
    }

    const language = await vscode.window.showQuickPick(['javascript', 'typescript'], {
      placeHolder: nls.localize('force_function_enter_language')
    });

    if (language === undefined) {
      return { type: 'CANCEL' };
    }
    // In order to reuse code used by other templates that have outputdir 
    // and extends DirFileNameSelection, we are passing an empty outputdir
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

const parameterGatherer = new CompositeParametersGatherer(
  new FunctionInfoGatherer()
);

export async function forceFunctionCreate() {
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    parameterGatherer,
    new ForceFunctionCreateExecutor()
  );
  await commandlet.run();
}
