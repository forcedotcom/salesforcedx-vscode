/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Connection, ConfigAggregator } from '@salesforce/core-bundle';
import { Tooling } from '@salesforce/core-bundle/org/connection';
import {
  CancelResponse,
  ContinueResponse,
  LibraryCommandletExecutor,
  ParametersGatherer,
  SfCommandlet,
  SfWorkspaceChecker,
  writeFile,
  workspaceUtils,
  Table,
  Column,
  Row
} from '@salesforce/salesforcedx-utils-vscode';
import * as path from 'node:path';
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
  constructor() {
    super(nls.localize('data_query_input_text'), 'data_soql_query_library', OUTPUT_CHANNEL);
    // Disable automatic success notifications since we show our own custom success notification
    // Keep failure notifications enabled for automatic error handling
    this.showSuccessNotifications = false;
  }

  public async run(response: ContinueResponse<QueryAndApiInputs>): Promise<boolean> {
    const { query, api } = response.data;

    try {
      // Get connection from workspace context
      const connection = await WorkspaceContext.getInstance().getConnection();

      // Execute query using the appropriate API
      const queryResult = await this.runSoqlQuery(api === 'TOOLING' ? connection.tooling : connection, query);

      // Display results in table format
      this.displayTableResults(queryResult);

      // Save results to CSV file and show notification
      await this.saveResultsToCSV(queryResult);

      return true;
    } catch (error) {
      const errorMessage = this.formatErrorMessage(error);
      channelService.appendLine(errorMessage);
      return false;
    }
  }

  /**
   * Executes a SOQL query using the provided connection (REST or Tooling API).
   * Applies user-configured query limits if set, otherwise allows results under Salesforce limits.
   *
   * @param connection - Salesforce connection (REST or Tooling API)
   * @param query - SOQL query string to execute
   * @returns Promise resolving to query results with records and metadata
   */
  private async runSoqlQuery(connection: Connection | Tooling, query: string): Promise<QueryResult> {
    channelService.appendLine(nls.localize('data_query_running_query'));

    // Get user-configured query limit (if any)
    const maxFetch = await this.getMaxFetch();

    // Execute query with appropriate options (with or without maxFetch limit)
    const result = await connection.query(query, this.buildQueryOptions(maxFetch));

    // Show warning if user-configured limit caused records to be truncated
    if (maxFetch !== undefined && result.records.length > 0 && result.totalSize > result.records.length) {
      const missingRecords = result.totalSize - result.records.length;
      channelService.appendLine(
        nls.localize('data_query_warning_limit', missingRecords, maxFetch, result.totalSize, maxFetch)
      );
    }

    channelService.appendLine(nls.localize('data_query_complete', result.totalSize));

    return result;
  }

  /**
   * Retrieves the maximum fetch limit from user configuration.
   * Checks SF CLI config first, then environment variable, then returns undefined if no limit is set.
   *
   * @returns Promise resolving to the configured limit number, or undefined if no limit is set.
   */
  private async getMaxFetch(): Promise<number | undefined> {
    try {
      // Priority 1: Check SF CLI config value (org-max-query-limit)
      const configAggregator = await ConfigAggregator.create();
      const configValue = configAggregator.getPropertyValue('org-max-query-limit');
      if (configValue) {
        const parsed = parseInt(String(configValue), 10);
        if (!isNaN(parsed) && parsed > 0) {
          return parsed;
        }
      }
    } catch {
      // If config reading fails, fall back to environment variable
    }

    // Priority 2: Check environment variable as fallback (SF_ORG_MAX_QUERY_LIMIT)
    const envValue = process.env.SF_ORG_MAX_QUERY_LIMIT;
    if (envValue) {
      const parsed = parseInt(envValue, 10);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }

    // No limit configured - return undefined to allow unlimited queries
    return undefined;
  }

  /**
   * Builds query options for the Salesforce connection query method.
   * Supports optional maxFetch limit when user has configured query limits.
   *
   * @param maxFetch - Optional maximum number of records to fetch. If undefined, no limit is applied.
   * @returns Query options object with autoFetch and scanAll settings, plus maxFetch if specified.
   */
  private buildQueryOptions(maxFetch?: number) {
    const baseOptions = {
      autoFetch: true,
      scanAll: false
    };

    // Conditionally add maxFetch if user has configured a limit
    return maxFetch ? { ...baseOptions, maxFetch } : baseOptions;
  }

  private async saveResultsToCSV(queryResult: QueryResult): Promise<void> {
    const csvContent = this.convertToCSV(queryResult);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `soql-query-${timestamp}.csv`;
    const outputDir = path.join(workspaceUtils.getRootWorkspacePath(), '.sfdx', 'data');
    const filePath = path.join(outputDir, fileName);
    await writeFile(filePath, csvContent);

    // Show success message with clickable file link
    const openFileAction = nls.localize('data_query_open_file');
    vscode.window
      .showInformationMessage(
        nls.localize('data_query_success_message', queryResult.totalSize, filePath),
        openFileAction
      )
      .then(selection => {
        if (selection === openFileAction) {
          vscode.workspace.openTextDocument(vscode.Uri.file(filePath)).then(doc => {
            vscode.window.showTextDocument(doc);
          });
        }
      });
  }

  private displayTableResults(queryResult: QueryResult): void {
    if (!queryResult.records || queryResult.records.length === 0) {
      channelService.appendLine(nls.localize('data_query_no_records'));
      return;
    }

    const tableOutput = generateTableOutput(queryResult.records, nls.localize('data_query_table_title'));
    channelService.appendLine(`\n${tableOutput}`);
  }

  private convertToCSV(queryResult: QueryResult): string {
    if (!queryResult.records || queryResult.records.length === 0) {
      return nls.localize('data_query_no_records');
    }

    return convertToCSV(queryResult.records);
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

type QueryAndApiInputs = {
  query: string;
  api: ApiType;
};

type ApiType = 'REST' | 'TOOLING';

const workspaceChecker = new SfWorkspaceChecker();

export const dataQuery = (explorerDir?: any): void => {
  const parameterGatherer = new GetQueryAndApiInputs();
  const commandlet = new SfCommandlet(workspaceChecker, parameterGatherer, new DataQueryExecutor());
  void commandlet.run();
};

/**
 * Generates table output from query records
 */
export const generateTableOutput = (records: any[], title: string): string => {
  if (!records || records.length === 0) {
    return '';
  }

  const fields = Object.keys(records[0]).filter(key => key !== 'attributes');
  const columns: Column[] = fields.map(field => ({
    key: field,
    label: field
  }));
  const rows: Row[] = records.map((record: { [x: string]: any }) =>
    Object.fromEntries(fields.map(field => [field, formatFieldValueForDisplay(record[field])]))
  );

  return new Table().createTable(rows, columns, title);
};

/**
 * Converts query records to CSV format
 */
export const convertToCSV = (records: any[]): string => {
  if (!records || records.length === 0) {
    return '';
  }

  const fields = Object.keys(records[0]).filter(key => key !== 'attributes');
  const header = fields.map(field => escapeCSVField(field)).join(',');
  const rows = records.map((record: { [x: string]: any }) =>
    fields
      .map(field => {
        const value = record[field];
        return escapeCSVField(formatFieldValue(value));
      })
      .join(',')
  );

  return [header, ...rows].join('\n');
};

/**
 * Escapes a field value for CSV format
 */
export const escapeCSVField = (field: string): string => {
  // If field contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (field.includes(',') || field.includes('"') || field.includes('\n') || field.includes('\r')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
};

/**
 * Formats a field value for CSV export
 */
export const formatFieldValue = (value: any): string => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    // Handle nested objects (like relationship fields)
    return JSON.stringify(value);
  }
  return String(value);
};

/**
 * Formats a field value for table display
 */
export const formatFieldValueForDisplay = (value: any): string => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    return value.Id ? value.Id : '[Object]';
  }
  const stringValue = String(value);
  // Truncate long values for display
  return stringValue.length > 50 ? `${stringValue.substring(0, 47)}...` : stringValue;
};
