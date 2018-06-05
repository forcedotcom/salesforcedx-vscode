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
  CompositeParametersGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './commands';

class ForceDataSoqlQueryExecutor extends SfdxCommandletExecutor<{}> {
  public build(data: QueryAndApi): Command {
    let command = new SfdxCommandBuilder()
      .withDescription(nls.localize('force_data_soql_query_input_text'))
      .withArg('force:data:soql:query')
      .withFlag('--query', `${data.query}`);
    if (data.api === ApiType.Tooling) {
      command = command.withArg('--usetoolingapi');
    }
    return command.build();
  }
}

export class GetQueryInput implements ParametersGatherer<QueryInput> {
  public async gather(): Promise<
    CancelResponse | ContinueResponse<QueryInput>
  > {
    const editor = await vscode.window.activeTextEditor;

    let query;

    if (!editor) {
      const userInputOptions = {
        prompt: nls.localize('parameter_gatherer_enter_soql_query')
      } as vscode.InputBoxOptions;
      query = await vscode.window.showInputBox(userInputOptions);
    } else {
      const document = editor.document;
      if (editor.selection.isEmpty) {
        const userInputOptions = {
          prompt: nls.localize('parameter_gatherer_enter_soql_query')
        } as vscode.InputBoxOptions;
        query = await vscode.window.showInputBox(userInputOptions);
      } else {
        query = document.getText(editor.selection);
      }
    }

    query = query!.replace('[', '').replace(']', '');
    return query ? { type: 'CONTINUE', data: { query } } : { type: 'CANCEL' };
  }
}

export enum ApiType {
  REST,
  Tooling
}

export interface QueryInput {
  query: string;
}
export interface ApiInput {
  api: ApiType;
}

export class SelectApi implements ParametersGatherer<ApiInput> {
  public async gather(): Promise<CancelResponse | ContinueResponse<ApiInput>> {
    const restApi = {
      api: ApiType.REST,
      label: nls.localize('REST_API'),
      description: nls.localize('REST_API_description')
    };

    const toolingApi = {
      api: ApiType.Tooling,
      label: nls.localize('tooling_API'),
      description: nls.localize('tooling_API_description')
    };

    const apiItems = [restApi, toolingApi];
    const selection = await vscode.window.showQuickPick(apiItems);
    return selection
      ? { type: 'CONTINUE', data: { api: selection.api } }
      : { type: 'CANCEL' };
  }
}

export type QueryAndApi = QueryInput & ApiInput;

const workspaceChecker = new SfdxWorkspaceChecker();

export async function forceDataSoqlQuery(explorerDir?: any) {
  const parameterGatherer = new CompositeParametersGatherer<QueryAndApi>(
    new GetQueryInput(),
    new SelectApi()
  );
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    new ForceDataSoqlQueryExecutor()
  );
  await commandlet.run();
}
