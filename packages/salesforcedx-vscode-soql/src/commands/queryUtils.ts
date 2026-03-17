/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { CancelResponse, ContinueResponse, ParametersGatherer } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { nls } from '../messages';

export type QueryAndApiInputs = {
  query: string;
  api: 'REST' | 'TOOLING';
};

export class GetQueryAndApiInputs implements ParametersGatherer<QueryAndApiInputs> {
  public async gather(): Promise<CancelResponse | ContinueResponse<QueryAndApiInputs>> {
    const editor = vscode.window.activeTextEditor;

    let query;

    if (!editor) {
      const userInputOptions: vscode.InputBoxOptions = {
        prompt: nls.localize('parameter_gatherer_enter_soql_query')
      };
      query = await vscode.window.showInputBox(userInputOptions);
    } else {
      const document = editor.document;
      if (editor.selection.isEmpty) {
        const userInputOptions: vscode.InputBoxOptions = {
          prompt: nls.localize('parameter_gatherer_enter_soql_query')
        };
        query = await vscode.window.showInputBox(userInputOptions);
      } else {
        query = document.getText(editor.selection);
      }
    }
    if (!query) {
      return { type: 'CANCEL' };
    }

    query = query
      .replace('[', '')
      .replace(']', '')
      .replaceAll(/(\r\n|\n)/g, ' ');

    const restApi = {
      api: 'REST' as const,
      label: nls.localize('REST_API'),
      description: nls.localize('REST_API_description')
    };

    const toolingApi = {
      api: 'TOOLING' as const,
      label: nls.localize('tooling_API'),
      description: nls.localize('tooling_API_description')
    };

    const apiItems = [restApi, toolingApi];
    const selection = await vscode.window.showQuickPick(apiItems);

    return selection ? { type: 'CONTINUE', data: { query, api: selection.api } } : { type: 'CANCEL' };
  }
}

export class GetDocumentQueryAndApiInputs implements ParametersGatherer<QueryAndApiInputs> {
  public async gather(): Promise<CancelResponse | ContinueResponse<QueryAndApiInputs>> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return { type: 'CANCEL' };
    }

    const query = editor.document.getText().replaceAll(/(\r\n|\n)/g, ' ').trim();
    if (!query) {
      return { type: 'CANCEL' };
    }

    const restApi = {
      api: 'REST' as const,
      label: nls.localize('REST_API'),
      description: nls.localize('REST_API_description')
    };

    const toolingApi = {
      api: 'TOOLING' as const,
      label: nls.localize('tooling_API'),
      description: nls.localize('tooling_API_description')
    };

    const selection = await vscode.window.showQuickPick([restApi, toolingApi]);
    return selection ? { type: 'CONTINUE', data: { query, api: selection.api } } : { type: 'CANCEL' };
  }
}

/** Formats error messages for better user experience */
export const formatErrorMessage = (error: unknown): string => {
  let errorString: string;
  if (error instanceof Error) {
    errorString = error.message;
  } else if (error && typeof error === 'object' && 'message' in error) {
    errorString = String(error.message);
  } else {
    errorString = String(error);
  }

  if (errorString.includes('HTTP response contains html content')) {
    return nls.localize('data_query_error_org_expired');
  }

  if (errorString.includes('INVALID_SESSION_ID')) {
    return nls.localize('data_query_error_session_expired');
  }

  if (errorString.includes('INVALID_LOGIN')) {
    return nls.localize('data_query_error_invalid_login');
  }

  if (errorString.includes('INSUFFICIENT_ACCESS')) {
    return nls.localize('data_query_error_insufficient_access');
  }

  if (errorString.includes('MALFORMED_QUERY')) {
    return nls.localize('data_query_error_malformed_query');
  }

  if (errorString.includes('INVALID_FIELD')) {
    return nls.localize('data_query_error_invalid_field');
  }

  if (errorString.includes('INVALID_TYPE')) {
    return nls.localize('data_query_error_invalid_type');
  }

  if (errorString.includes('connection') || errorString.includes('network')) {
    return nls.localize('data_query_error_connection');
  }

  if (errorString.includes('tooling') && errorString.includes('not found')) {
    return nls.localize('data_query_error_tooling_not_found');
  }

  return nls.localize('data_query_error_message', errorString);
};
