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
import * as vscode from 'vscode';
import { nls } from '../messages';
import {
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './commands';

class ForceDataSoqlQueryExecutor extends SfdxCommandletExecutor<{}> {
  public build(data: QueryInput): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_data_soql_query_input_text'))
      .withArg('force:data:soql:query')
      .withFlag('--query', `${data.input}`)
      .build();
  }
}

export type QueryInput = {
  input: string;
};

export class GetQueryInput implements ParametersGatherer<{ input: string }> {
  public async gather(): Promise<
    CancelResponse | ContinueResponse<{ input: string }>
  > {
    const editor = await vscode.window.activeTextEditor;

    let input;

    if (!editor) {
      const userInputOptions = {
        prompt: nls.localize('parameter_gatherer_enter_soql_query')
      } as vscode.InputBoxOptions;
      input = await vscode.window.showInputBox(userInputOptions);
    } else {
      const document = editor.document;
      if (editor.selection.isEmpty) {
        const userInputOptions = {
          prompt: nls.localize('parameter_gatherer_enter_soql_query')
        } as vscode.InputBoxOptions;
        input = await vscode.window.showInputBox(userInputOptions);
      } else {
        input = document.getText(editor.selection);
      }
    }

    input = input!.replace('[', '').replace(']', '');
    return input ? { type: 'CONTINUE', data: { input } } : { type: 'CANCEL' };
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();

export async function forceDataSoqlQuery(explorerDir?: any) {
  const parameterGatherer = new GetQueryInput();
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    new ForceDataSoqlQueryExecutor()
  );
  commandlet.run();
}
