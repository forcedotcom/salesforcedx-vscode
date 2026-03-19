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

export type QueryInputs = { query: string };

const API_ITEMS = [
  { api: 'REST' as const, label: nls.localize('REST_API'), description: nls.localize('REST_API_description') },
  { api: 'TOOLING' as const, label: nls.localize('tooling_API'), description: nls.localize('tooling_API_description') }
];

const INPUT_BOX_OPTIONS: vscode.InputBoxOptions = {
  prompt: nls.localize('parameter_gatherer_enter_soql_query')
};

const normalizeQuery = (q: string): string =>
  q.replace('[', '').replace(']', '').replaceAll(/(\r\n|\n)/g, ' ').trim();

const pickApiForQuery = async (
  query: string
): Promise<CancelResponse | ContinueResponse<QueryAndApiInputs>> => {
  const selection = await vscode.window.showQuickPick(API_ITEMS);
  return selection ? { type: 'CONTINUE', data: { query, api: selection.api } } : { type: 'CANCEL' };
};

export class GetQueryAndApiInputs implements ParametersGatherer<QueryAndApiInputs> {
  public async gather(): Promise<CancelResponse | ContinueResponse<QueryAndApiInputs>> {
    const editor = vscode.window.activeTextEditor;
    const query = !editor
      ? await vscode.window.showInputBox(INPUT_BOX_OPTIONS)
      : editor.selection.isEmpty
        ? await vscode.window.showInputBox(INPUT_BOX_OPTIONS)
        : editor.document.getText(editor.selection);
    if (!query) {
      return { type: 'CANCEL' };
    }
    return pickApiForQuery(normalizeQuery(query));
  }
}

export class GetDocumentQueryAndApiInputs implements ParametersGatherer<QueryAndApiInputs> {
  public async gather(): Promise<CancelResponse | ContinueResponse<QueryAndApiInputs>> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return { type: 'CANCEL' };
    }
    const query = normalizeQuery(editor.document.getText());
    return query ? pickApiForQuery(query) : { type: 'CANCEL' };
  }
}

export class GetQueryInputsForPlan implements ParametersGatherer<QueryInputs> {
  public async gather(): Promise<CancelResponse | ContinueResponse<QueryInputs>> {
    const editor = vscode.window.activeTextEditor;
    const query = !editor
      ? await vscode.window.showInputBox(INPUT_BOX_OPTIONS)
      : editor.selection.isEmpty
        ? await vscode.window.showInputBox(INPUT_BOX_OPTIONS)
        : editor.document.getText(editor.selection);
    return query ? { type: 'CONTINUE', data: { query: normalizeQuery(query) } } : { type: 'CANCEL' };
  }
}

export class GetDocumentQueryInputsForPlan implements ParametersGatherer<QueryInputs> {
  public async gather(): Promise<CancelResponse | ContinueResponse<QueryInputs>> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return { type: 'CANCEL' };
    }
    const query = normalizeQuery(editor.document.getText());
    return query ? { type: 'CONTINUE', data: { query } } : { type: 'CANCEL' };
  }
}

const ERROR_PATTERNS = [
  { match: (s: string) => s.includes('HTTP response contains html content'), key: 'data_query_error_org_expired' },
  { match: (s: string) => s.includes('INVALID_SESSION_ID'), key: 'data_query_error_session_expired' },
  { match: (s: string) => s.includes('INVALID_LOGIN'), key: 'data_query_error_invalid_login' },
  { match: (s: string) => s.includes('INSUFFICIENT_ACCESS'), key: 'data_query_error_insufficient_access' },
  { match: (s: string) => s.includes('MALFORMED_QUERY'), key: 'data_query_error_malformed_query' },
  { match: (s: string) => s.includes('INVALID_FIELD'), key: 'data_query_error_invalid_field' },
  { match: (s: string) => s.includes('INVALID_TYPE'), key: 'data_query_error_invalid_type' },
  { match: (s: string) => s.includes('connection') || s.includes('network'), key: 'data_query_error_connection' },
  { match: (s: string) => s.includes('tooling') && s.includes('not found'), key: 'data_query_error_tooling_not_found' }
] as const;

/** Formats error messages for better user experience */
export const formatErrorMessage = (error: unknown): string => {
  const errorString =
    error instanceof Error
      ? error.message
      : error && typeof error === 'object' && 'message' in error
        ? String(error.message)
        : String(error);
  const matched = ERROR_PATTERNS.find(({ match }) => match(errorString));
  return matched ? nls.localize(matched.key) : nls.localize('data_query_error_message', errorString);
};
