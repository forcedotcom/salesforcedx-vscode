/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Connection, Tooling } from '@salesforce/core-bundle/org/connection';
import {
  CancelResponse,
  Column,
  ContinueResponse,
  LibraryCommandletExecutor,
  ParametersGatherer,
  Row,
  SfCommandlet,
  SfWorkspaceChecker,
  Table,
  workspaceUtils,
  writeFile
} from '@salesforce/salesforcedx-utils-vscode';
import path from 'node:path';
import * as vscode from 'vscode';
import { channelService, OUTPUT_CHANNEL } from '../channels';
import { WorkspaceContext } from '../context';
import { nls } from '../messages';

interface QueryResult {
  records: any[];
  totalSize: number;
  done: boolean;
}

class DataQueryExecutor extends LibraryCommandletExecutor<QueryAndApiInputs> {
  private readonly MAX_FETCH = 50_000;

  constructor() {
    super(nls.localize('data_query_input_text'), 'data_soql_query_library', OUTPUT_CHANNEL);
  }

  public async run(response: ContinueResponse<QueryAndApiInputs>): Promise<boolean> {
    const { query, api } = response.data;

    try {
      // Get connection from workspace context
      const connection = await WorkspaceContext.getInstance().getConnection();

      // Execute query using the appropriate API
      const queryResult = await this.runSoqlQuery(api === ApiType.TOOLING ? connection.tooling : connection, query);

      // Display results in table format
      this.displayTableResults(queryResult);

      // Convert results to CSV and save to file
      const csvContent = this.convertToCSV(queryResult);

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `soql-query-${timestamp}.csv`;

      // Get workspace path and create output directory
      const outputDir = path.join(workspaceUtils.getRootWorkspacePath(), '.sfdx', 'data');
      const filePath = path.join(outputDir, fileName);

      // Write CSV file
      await writeFile(filePath, csvContent);

      // Open the file in editor
      const document = await vscode.workspace.openTextDocument(filePath);
      await vscode.window.showTextDocument(document);

      // Show success message
      const recordCount = queryResult.totalSize;
      channelService.appendLine(nls.localize('data_query_success_message', recordCount.toString(), filePath));

      return true;
    } catch (error) {
      const errorMessage = this.formatErrorMessage(error);
      channelService.appendLine(errorMessage);
      return false;
    }
  }

  private async runSoqlQuery(connection: Connection | Tooling, query: string): Promise<QueryResult> {
    channelService.appendLine('Running query...');

    const result = await connection.query(query, {
      autoFetch: true,
      maxFetch: this.MAX_FETCH,
      scanAll: false
    });

    if (result.records.length > 0 && result.totalSize > result.records.length) {
      const missingRecords = result.totalSize - result.records.length;
      channelService.appendLine(
        `Warning: The query result is missing ${missingRecords} records due to a ${this.MAX_FETCH} record limit. ` +
          `Increase the number of records returned by setting the config value "org-max-query-limit" or the environment variable "SF_ORG_MAX_QUERY_LIMIT" to ${result.totalSize} or greater than ${this.MAX_FETCH}.`
      );
    }

    channelService.appendLine(`Query complete with ${result.totalSize} records returned`);

    return result;
  }

  private displayTableResults(queryResult: QueryResult): void {
    if (!queryResult.records || queryResult.records.length === 0) {
      channelService.appendLine('No records found');
      return;
    }

    const records = queryResult.records;
    const fields = Object.keys(records[0]).filter(key => key !== 'attributes');

    // Create table columns
    const columns: Column[] = fields.map(field => ({
      key: field,
      label: field
    }));

    // Create table rows
    const rows: Row[] = records.map((record: { [x: string]: any }) => {
      const row: Row = {};
      fields.forEach(field => {
        const value = record[field];
        row[field] = this.formatFieldValueForDisplay(value);
      });
      return row;
    });

    // Create and display table
    const table = new Table();
    const tableOutput = table.createTable(rows, columns, 'Query Results');

    channelService.appendLine(`\n${tableOutput}`);
  }

  private convertToCSV(queryResult: QueryResult): string {
    if (!queryResult.records || queryResult.records.length === 0) {
      return 'No records found';
    }

    const records = queryResult.records;
    const fields = Object.keys(records[0]).filter(key => key !== 'attributes');

    // Create CSV header
    const header = fields.map(field => this.escapeCSVField(field)).join(',');

    // Create CSV rows
    const rows = records.map((record: { [x: string]: any }) =>
      fields
        .map(field => {
          const value = record[field];
          return this.escapeCSVField(this.formatFieldValue(value));
        })
        .join(',')
    );

    return [header, ...rows].join('\n');
  }

  private escapeCSVField(field: string): string {
    // If field contains comma, quote, or newline, wrap in quotes and escape internal quotes
    if (field.includes(',') || field.includes('"') || field.includes('\n') || field.includes('\r')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  }

  private formatFieldValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'object') {
      // Handle nested objects (like relationship fields)
      return JSON.stringify(value);
    }
    return String(value);
  }

  private formatFieldValueForDisplay(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'object') {
      // For display, show a simplified version of nested objects
      if (value.Id) {
        return value.Id;
      }
      return '[Object]';
    }
    const stringValue = String(value);
    // Truncate long values for display
    return stringValue.length > 30 ? `${stringValue.substring(0, 27)}...` : stringValue;
  }

  private formatErrorMessage(error: any): string {
    const errorString = error instanceof Error ? error.message : String(error);

    // Check for common error patterns and provide better messages
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

    // For tooling API specific errors
    if (errorString.includes('tooling') && errorString.includes('not found')) {
      return nls.localize('data_query_error_tooling_not_found');
    }

    // Default error message
    return nls.localize('data_query_error_message', errorString);
  }
}

class GetQueryAndApiInputs implements ParametersGatherer<QueryAndApiInputs> {
  public async gather(): Promise<CancelResponse | ContinueResponse<QueryAndApiInputs>> {
    const editor = await vscode.window.activeTextEditor;

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
      .replace(/(\r\n|\n)/g, ' ');

    const restApi = {
      api: ApiType.REST,
      label: nls.localize('REST_API'),
      description: nls.localize('REST_API_description')
    };

    const toolingApi = {
      api: ApiType.TOOLING,
      label: nls.localize('tooling_API'),
      description: nls.localize('tooling_API_description')
    };

    const apiItems = [restApi, toolingApi];
    const selection = await vscode.window.showQuickPick(apiItems);

    return selection ? { type: 'CONTINUE', data: { query, api: selection.api } } : { type: 'CANCEL' };
  }
}

type QueryAndApiInputs = {
  query: string;
  api: ApiType;
};

enum ApiType {
  REST,
  TOOLING
}

const workspaceChecker = new SfWorkspaceChecker();

export const dataQuery = (): void => {
  const parameterGatherer = new GetQueryAndApiInputs();
  const commandlet = new SfCommandlet(workspaceChecker, parameterGatherer, new DataQueryExecutor());
  void commandlet.run();
};
