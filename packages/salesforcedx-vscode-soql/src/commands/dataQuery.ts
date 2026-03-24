/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { Connection } from '@salesforce/core';
import { Column, createTable, ExtensionProviderService, Row } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { Utils } from 'vscode-uri';
import { nls } from '../messages';
import { formatErrorMessage, getQueryAndApiInputs } from './queryUtils';

type QueryResult = Awaited<ReturnType<Connection['query']>>;

/**
 * Executes a SOQL query, auto-fetching all pages of results up to the user-configured
 * `org-max-query-limit` (default 10,000). Emits a lifecycle warning if results are truncated.
 *
 * @param query - SOQL query string to execute
 * @param useTooling - Whether to use the Tooling API instead of REST
 */
const runSoqlQuery = Effect.fn('runSoqlQuery')(function* (query: string, useTooling: boolean = false) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const connection = yield* api.services.ConnectionService.getConnection();
  const channelService = yield* api.services.ChannelService;

  yield* channelService.appendToChannel(
    nls.localize('data_query_running_query', useTooling ? nls.localize('tooling_API') : nls.localize('REST_API'))
  );

  return yield* Effect.promise(() => connection.autoFetchQuery(query, { tooling: useTooling }));
});

const saveResultsToCSV = Effect.fn('saveResultsToCSV')(function* (queryResult: QueryResult) {
  const csvContent = convertQueryResultToCSV(queryResult);

  const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
  const fileName = `soql-query-${timestamp}.csv`;
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const { uri: workspaceUri } = yield* api.services.WorkspaceService.getWorkspaceInfoOrThrow();
  const fileUri = Utils.joinPath(workspaceUri, '.sfdx', 'data', fileName);
  yield* api.services.FsService.writeFile(fileUri, csvContent);

  // Show success message with clickable file link
  const openFileAction = nls.localize('data_query_open_file');
  yield* Effect.promise(() =>
    vscode.window
      .showInformationMessage(
        nls.localize('data_query_success_message', queryResult.totalSize, fileUri.fsPath),
        openFileAction
      )
      .then(selection => {
        if (selection === openFileAction) {
          vscode.workspace.openTextDocument(fileUri).then(doc => {
            vscode.window.showTextDocument(doc);
          });
        }
      })
  );
});

export const dataQuery = Effect.fn('sf.data.query')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const channelService = yield* api.services.ChannelService;
  const { query, api: queryApi } = yield* getQueryAndApiInputs();

  if (vscode.workspace.getConfiguration('salesforcedx-vscode-core').get<boolean>('clearOutputTab', false)) {
    yield* channelService.clearChannel;
  }

  const vscChannel = yield* channelService.getChannel;

  try {
    const queryResult = yield* runSoqlQuery(query, queryApi === 'TOOLING');
    yield* Effect.all(
      [
        displayTableResults(queryResult),
        channelService.appendToChannel(nls.localize('data_query_complete', queryResult.totalSize)),
        saveResultsToCSV(queryResult),
        Effect.sync(() => vscChannel.show())
      ],
      { concurrency: 'unbounded' }
    );
  } catch (error) {
    yield* channelService.appendToChannel(formatErrorMessage(error));
    vscChannel.show();
  }
});

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
export const escapeCSVField = (field: string): string =>
  field.includes(',') || field.includes('"') || field.includes('\n') || field.includes('\r')
    ? `"${field.replaceAll('"', '""')}"`
    : field;

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

/** Displays query results in table format */
export const displayTableResults = Effect.fn('displayTableResults')(function* (queryResult: QueryResult) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const channelService = yield* api.services.ChannelService;

  if (!queryResult.records?.length) {
    yield* channelService.appendToChannel(nls.localize('data_query_no_records'));
    return;
  }

  const tableOutput = generateTableOutput(queryResult.records, nls.localize('data_query_table_title'));
  yield* channelService.appendToChannel(`\n${tableOutput}`);
});

/** Converts query result to CSV string */
export const convertQueryResultToCSV = (queryResult: QueryResult): string =>
  queryResult.records?.length ? convertToCSV(queryResult.records) : nls.localize('data_query_no_records');
