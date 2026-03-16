/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { Connection } from '@salesforce/core';
import { getServicesApi, sfProjectPreconditionChecker } from '@salesforce/effect-ext-utils';
import {
  CancelResponse,
  Column,
  ContinueResponse,
  createTable,
  ParametersGatherer,
  Row,
  SfCommandlet
} from '@salesforce/salesforcedx-utils-vscode';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { Utils } from 'vscode-uri';
import { nls } from '../messages';
import { channelService } from '../services/channel';
import { getSoqlRuntime } from '../services/extensionProvider';
import { getConnection } from '../services/org';

type QueryResult = Awaited<ReturnType<Connection['query']>>;

class DataQueryExecutor {
  public async execute(response: ContinueResponse<QueryAndApiInputs>): Promise<void> {
    if (vscode.workspace.getConfiguration('salesforcedx-vscode-core').get<boolean>('clearOutputTab', false)) {
      channelService.clear();
    }

    const { query, api } = response.data;

    try {
      const connection = await getConnection();
      const queryResult = await runSoqlQuery(connection, query, api === 'TOOLING');
      displayTableResults(queryResult);
      channelService.appendLine(nls.localize('data_query_complete', queryResult.totalSize));
      await this.saveResultsToCSV(queryResult);
    } catch (error) {
      channelService.appendLine(formatErrorMessage(error));
    } finally {
      channelService.show();
    }
  }

  private async saveResultsToCSV(queryResult: QueryResult): Promise<void> {
    const csvContent = convertQueryResultToCSV(queryResult);

    const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
    const fileName = `soql-query-${timestamp}.csv`;
    const fileUri = await getSoqlRuntime().runPromise(
      Effect.gen(function* () {
        const api = yield* getServicesApi;
        const { uri: workspaceUri } = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();
        const uri = Utils.joinPath(workspaceUri, '.sfdx', 'data', fileName);
        yield* api.services.FsService.writeFile(uri, csvContent);
        return uri;
      })
    );
    const filePath = fileUri.fsPath;

    // Show success message with clickable file link
    const openFileAction = nls.localize('data_query_open_file');
    vscode.window
      .showInformationMessage(
        nls.localize('data_query_success_message', queryResult.totalSize, filePath),
        openFileAction
      )
      .then(selection => {
        if (selection === openFileAction) {
          vscode.workspace.openTextDocument(fileUri).then(doc => {
            vscode.window.showTextDocument(doc);
          });
        }
      });
  }
}

class GetQueryAndApiInputs implements ParametersGatherer<QueryAndApiInputs> {
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

type QueryAndApiInputs = {
  query: string;
  api: 'REST' | 'TOOLING';
};

export const dataQuery = Effect.fn('sf.data.query')(function* () {
  const commandlet = new SfCommandlet(sfProjectPreconditionChecker, new GetQueryAndApiInputs(), new DataQueryExecutor());
  yield* Effect.promise(() => commandlet.run());
});

class GetDocumentQueryAndApiInputs implements ParametersGatherer<QueryAndApiInputs> {
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

export const dataQueryDocument = Effect.fn('sf.data.query.document')(function* () {
  const commandlet = new SfCommandlet(
    sfProjectPreconditionChecker,
    new GetDocumentQueryAndApiInputs(),
    new DataQueryExecutor()
  );
  yield* Effect.promise(() => commandlet.run());
});

/**
 * Retrieves the maximum fetch limit from user configuration.
 * Checks SF CLI config first, then environment variable, then returns undefined if no limit is set.
 *
 * @returns Promise resolving to the configured limit number, or undefined if no limit is set.
 */
const getMaxFetch = async (): Promise<number | undefined> => {
  try {
    // Priority 1: Check SF CLI config value (org-max-query-limit)
    const configAggregator = await getSoqlRuntime().runPromise(
      Effect.gen(function* () {
        const api = yield* getServicesApi;
        return yield* api.services.ConfigService.getConfigAggregator();
      })
    );
    const configValue = configAggregator.getPropertyValue<string>('org-max-query-limit');
    if (configValue) {
      const parsed = parseInt(configValue, 10);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
  } catch {
    // If config reading fails, fall back to no limit
  }

  // No limit configured - return undefined to allow default amount of queries
  return undefined;
};

/** Generates table output from query records */
export const generateTableOutput = (records: QueryResult['records'], title: string): string => {
  // Ensure the first record exists and is an object
  const firstRecord = records[0];
  if (!isRecord(firstRecord)) {
    return '';
  }

  // Flatten nested objects into separate columns
  // Examine all records to find the complete field structure
  const flattenedFields = getAllFlattenedFields(records.filter(isRecord));

  // If no fields after flattening, return empty string
  if (flattenedFields.length === 0) {
    return '';
  }

  const columns: Column[] = flattenedFields.map(field => ({
    key: field,
    label: field
  }));

  const rows: Row[] = records.filter(isRecord).map(record => {
    const flattenedRecord = flattenRecord(record);
    return Object.fromEntries(
      flattenedFields.map(field => [field, formatFieldValueForDisplay(flattenedRecord[field])])
    );
  });

  return createTable(rows, columns, title);
};

const isRecord = (record: unknown): record is Record<string, unknown> =>
  Boolean(record) && typeof record === 'object' && !Array.isArray(record);

/** Flattens a record by converting nested objects to dot notation field names */
const flattenRecord = (record: Record<string, unknown>): Record<string, unknown> => {
  const flattened: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    if (key === 'attributes') {
      continue; // Skip attributes field
    }

    if (isRecord(value)) {
      // Flatten nested object
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        if (nestedKey !== 'attributes') {
          flattened[`${key}.${nestedKey}`] = nestedValue;
        }
      }
    } else {
      // Keep primitive values as-is
      flattened[key] = value;
    }
  }

  return flattened;
};

/**
 * Gets all possible flattened field names by examining all records.
 * Preserves the original SELECT column order, including fields whose value is null
 * in early records (e.g. AnnualRevenue = null).
 *
 * Pass 1: build a stable base key order from all records (including null-valued fields)
 * and identify which keys are relationship objects in any record.
 * Pass 2: for each base key, expand relationship keys into dot-notation sub-fields
 * or emit plain keys as-is.
 */
const getAllFlattenedFields = (records: Record<string, unknown>[]): string[] => {
  // Pass 1: stable key order + relationship detection
  const baseOrder: string[] = [];
  const seenBase = new Set<string>();
  const relationshipKeys = new Set<string>();

  for (const record of records) {
    for (const [key, value] of Object.entries(record)) {
      if (key === 'attributes') {
        continue;
      }
      if (!seenBase.has(key)) {
        baseOrder.push(key);
        seenBase.add(key);
      }
      if (isRecord(value)) {
        relationshipKeys.add(key);
      }
    }
  }

  // Pass 2: expand relationship keys; emit plain keys as-is
  const fieldOrder: string[] = [];
  const seenFields = new Set<string>();

  for (const key of baseOrder) {
    if (relationshipKeys.has(key)) {
      for (const record of records) {
        const value = record[key];
        if (isRecord(value)) {
          for (const nestedKey of Object.keys(value)) {
            if (nestedKey !== 'attributes') {
              const fieldName = `${key}.${nestedKey}`;
              if (!seenFields.has(fieldName)) {
                fieldOrder.push(fieldName);
                seenFields.add(fieldName);
              }
            }
          }
        }
      }
    } else {
      if (!seenFields.has(key)) {
        fieldOrder.push(key);
        seenFields.add(key);
      }
    }
  }

  return fieldOrder;
};

/** Converts query records to CSV format */
export const convertToCSV = (records: QueryResult['records']): string => {
  if (!records?.length) {
    return '';
  }

  // Ensure the first record exists and is an object
  const firstRecord = records[0];
  if (!isRecord(firstRecord)) {
    return '';
  }

  const fields = Object.keys(firstRecord).filter(key => key !== 'attributes');
  // If no fields after filtering attributes, return empty string
  if (fields.length === 0) {
    return '';
  }

  const header = fields.map(field => escapeCSVField(field)).join(',');
  const rows = records
    .filter(isRecord)
    .map(record => fields.map(field => escapeCSVField(formatFieldValue(record[field]))).join(','));

  return [header, ...rows].join('\n');
};

/** Escapes a field value for CSV format */
export const escapeCSVField = (field: string): string => {
  // If field contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (field.includes(',') || field.includes('"') || field.includes('\n') || field.includes('\r')) {
    return `"${field.replaceAll('"', '""')}"`;
  }
  return field;
};

/** Formats a field value for CSV export */
export const formatFieldValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    // Handle nested objects (like relationship fields)
    return JSON.stringify(value);
  }
  return String(value);
};

/** Formats a field value for table display */
export const formatFieldValueForDisplay = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object' && isRecord(value)) {
    // Handle nested objects (like relationship fields)
    const obj = value;

    // Filter out attributes field and collect all values
    const values = Object.entries(obj)
      .filter(([key]) => key !== 'attributes')
      .map(([_key, val]) => String(val))
      .join(', ');

    if (values) {
      // Truncate long values for display
      return values.length > 50 ? `${values.substring(0, 47)}...` : values;
    }

    // Fallback for empty objects
    return '[Object]';
  }
  const stringValue = String(value);
  // Truncate long values for display
  return stringValue.length > 50 ? `${stringValue.substring(0, 47)}...` : stringValue;
};

/**
 * Builds query options for the Salesforce connection query method.
 * Supports optional maxFetch limit when user has configured query limits.
 *
 * @param maxFetch - Optional maximum number of records to fetch. If undefined, no limit is applied.
 * @returns Query options object with autoFetch and scanAll settings, plus maxFetch if specified.
 */
export const buildQueryOptions = (maxFetch?: number) => {
  const baseOptions = {
    autoFetch: true,
    scanAll: false
  };

  // Conditionally add maxFetch if user has configured a limit (including 0)
  return maxFetch !== undefined ? { ...baseOptions, maxFetch } : baseOptions;
};

/** Displays query results in table format */
export const displayTableResults = (queryResult: QueryResult): void => {
  if (!queryResult.records?.length) {
    channelService.appendLine(nls.localize('data_query_no_records'));
    return;
  }

  const tableOutput = generateTableOutput(queryResult.records, nls.localize('data_query_table_title'));
  channelService.appendLine(`\n${tableOutput}`);
};

/** Converts query result to CSV string */
export const convertQueryResultToCSV = (queryResult: QueryResult): string => {
  if (!queryResult.records?.length) {
    return nls.localize('data_query_no_records');
  }

  return convertToCSV(queryResult.records);
};

/** Formats error messages for better user experience */
export const formatErrorMessage = (error: unknown): string => {
  // Handle different error formats
  let errorString: string;
  if (error instanceof Error) {
    errorString = error.message;
  } else if (error && typeof error === 'object' && 'message' in error) {
    errorString = String(error.message);
  } else {
    errorString = String(error);
  }

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
};

/**
 * Executes a SOQL query using the provided connection (REST or Tooling API).
 * Applies user-configured query limits if set, otherwise allows results under Salesforce limits.
 *
 * @param connection - Salesforce connection (REST or Tooling API)
 * @param query - SOQL query string to execute
 * @returns Promise resolving to query results with records and metadata
 */
const runSoqlQuery = async (connection: Connection, query: string, useTooling = false): Promise<QueryResult> => {
  channelService.appendLine(nls.localize('data_query_running_query'));

  // Get user-configured query limit (if any)
  const maxFetch = await getMaxFetch();

  // Execute query with appropriate options (with or without maxFetch limit)
  const result = await (useTooling ? connection.tooling : connection).query(query, buildQueryOptions(maxFetch));

  // Show warning if user-configured limit caused records to be truncated
  if (maxFetch !== undefined && result.records.length > 0 && result.totalSize > result.records.length) {
    const missingRecords = result.totalSize - result.records.length;
    channelService.appendLine(
      nls.localize('data_query_warning_limit', missingRecords, maxFetch, result.totalSize, maxFetch)
    );
  }

  return result;
};
