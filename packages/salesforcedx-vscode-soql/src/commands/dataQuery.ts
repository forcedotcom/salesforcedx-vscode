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
    const truncated = queryResult.records.length > 0 && queryResult.totalSize > queryResult.records.length;
    const statusMessage = truncated
      ? nls.localize('data_query_warning_limit', queryResult.totalSize - queryResult.records.length, queryResult.records.length, queryResult.totalSize, queryResult.records.length)
      : nls.localize('data_query_complete', queryResult.totalSize);
    yield* Effect.all(
      [
        displayTableResults(queryResult),
        channelService.appendToChannel(statusMessage),
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

/** Shared flatten pipeline for output channel table, CSV, and Query Data View. */
const buildFlattenedGridModel = (
  records: QueryResult['records']
): { flattenedFields: string[]; rows: Record<string, unknown>[] } | null => {
  const recs = records?.filter(isRecord) ?? [];
  if (recs.length === 0) {
    return null;
  }
  const flattenedFields = getAllFlattenedFields(recs);
  if (flattenedFields.length === 0) {
    return null;
  }
  const rows = recs.flatMap(record => flattenRecord(record));
  return { flattenedFields, rows };
};

/** Pre-flattened grid for SOQL Builder webview (string cells for Tabulator). */
export const getFlattenedSoqlGridPayload = (
  records: QueryResult['records']
): { fields: string[]; rowData: Record<string, string>[] } | null => {
  const model = buildFlattenedGridModel(records);
  if (!model) {
    return null;
  }
  const { flattenedFields, rows } = model;
  const rowData = rows.map(row =>
    Object.fromEntries(flattenedFields.map(field => [field, formatFieldValueForDisplay(row[field])]))
  );
  return { fields: flattenedFields, rowData };
};

/** Generates table output from query records */
export const generateTableOutput = (records: QueryResult['records'], title: string): string => {
  const model = buildFlattenedGridModel(records);
  if (!model) {
    return '';
  }
  const { flattenedFields, rows } = model;

  const columns: Column[] = flattenedFields.map(field => ({
    key: field,
    label: field
  }));

  const tableRows: Row[] = rows.map(flattenedRecord =>
    Object.fromEntries(flattenedFields.map(field => [field, formatFieldValueForDisplay(flattenedRecord[field])]))
  );

  return createTable(tableRows, columns, title);
};

const isRecord = (record: unknown): record is Record<string, unknown> =>
  Boolean(record) && typeof record === 'object' && !Array.isArray(record);

/** Checks if a value is a Salesforce sub-query result (e.g. SELECT … FROM Contacts) */
const isSubQueryResult = (
  value: unknown
): value is { totalSize: number; done: boolean; records: unknown[] } => {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.totalSize === 'number' &&
    typeof value.done === 'boolean' &&
    Array.isArray(value.records)
  );
};

const RELATIONSHIP_FLATTEN_MAX_DEPTH = 10;
const SUBQUERY_FLATTEN_MAX_DEPTH = 5;

/** True for nested SObjects / relationship blobs, false for sub-query envelopes. */
const isNestedRelationshipObject = (value: unknown): value is Record<string, unknown> =>
  isRecord(value) && !isSubQueryResult(value);

/**
 * Flattens a relationship-shaped object into dotted keys on `row` (e.g. Owner.Manager.Name).
 * Scalars and non-records are stored at `prefix` when recursion cannot descend.
 */
const mergeRelationshipFieldsIntoRow = (
  row: Record<string, unknown>,
  prefix: string,
  value: unknown,
  depthRemaining: number
): void => {
  if (depthRemaining <= 0) {
    row[prefix] = value;
    return;
  }
  if (!isNestedRelationshipObject(value)) {
    row[prefix] = value;
    return;
  }
  const keys = Object.keys(value).filter(k => k !== 'attributes');
  if (keys.length === 0) {
    return;
  }
  for (const nk of keys) {
    const nv = value[nk];
    const path = `${prefix}.${nk}`;
    if (isNestedRelationshipObject(nv)) {
      mergeRelationshipFieldsIntoRow(row, path, nv, depthRemaining - 1);
    } else {
      row[path] = nv;
    }
  }
};

/** Collects dotted field paths for relationship objects (field discovery). */
const collectRelationshipFieldPaths = (
  prefix: string,
  value: unknown,
  addField: (name: string) => void,
  depthRemaining: number
): void => {
  if (depthRemaining <= 0) {
    addField(prefix);
    return;
  }
  if (!isNestedRelationshipObject(value)) {
    addField(prefix);
    return;
  }
  const keys = Object.keys(value).filter(k => k !== 'attributes');
  if (keys.length === 0) {
    return;
  }
  for (const nk of keys) {
    const nv = value[nk];
    const path = `${prefix}.${nk}`;
    if (isNestedRelationshipObject(nv)) {
      collectRelationshipFieldPaths(path, nv, addField, depthRemaining - 1);
    } else {
      addField(path);
    }
  }
};

/**
 * Flattens a record into one or more rows, matching the Salesforce CLI display style.
 * Each sub-query's first element shares row 0 with the parent fields and other
 * sub-queries' first elements. Remaining elements ("overflow") are stacked in
 * subsequent rows in sub-query order, with all other columns blank on those rows.
 * Total rows = 1 + sum(len - 1) for each sub-query — never a cross-product.
 * When a sub-query has no records the parent row is still emitted with empty sub-columns.
 */
const flattenRecordWithSubQueryDepth = (
  record: Record<string, unknown>,
  depthRemaining: number,
  keyPrefix = ''
): Record<string, unknown>[] => {
  const baseRow: Record<string, unknown> = {};
  const subQueryExpansions: Record<string, unknown>[][] = [];

  for (const [key, value] of Object.entries(record)) {
    if (key === 'attributes') {
      continue;
    }
    const pathPrefix = keyPrefix ? `${keyPrefix}.${key}` : key;

    if (isSubQueryResult(value)) {
      if (depthRemaining <= 0) {
        baseRow[pathPrefix] = value;
        continue;
      }
      if (value.records.length > 0) {
        const expandedRows = value.records.filter(isRecord).flatMap(subRecord =>
          flattenRecordWithSubQueryDepth(subRecord, depthRemaining - 1, pathPrefix)
        );
        if (expandedRows.length > 0) {
          subQueryExpansions.push(expandedRows);
        }
      }
      // When totalSize === 0 no expansion is pushed; the parent row is emitted as-is
      // with undefined sub-columns, which display as empty strings.
    } else if (isRecord(value)) {
      // Flatten relationship objects into dot-notation columns (multi-level)
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        if (nestedKey === 'attributes') {
          continue;
        }
        const nestedPathPrefix = `${pathPrefix}.${nestedKey}`;
        if (isNestedRelationshipObject(nestedValue)) {
          mergeRelationshipFieldsIntoRow(baseRow, nestedPathPrefix, nestedValue, RELATIONSHIP_FLATTEN_MAX_DEPTH);
        } else {
          baseRow[nestedPathPrefix] = nestedValue;
        }
      }
    } else {
      baseRow[pathPrefix] = value;
    }
  }

  if (subQueryExpansions.length === 0) {
    return [baseRow];
  }

  // Total rows = 1 + sum of (each sub-query's overflow = length - 1)
  const totalRows = subQueryExpansions.reduce((sum, exp) => sum + exp.length - 1, 1);

  // Allocate the grid. Row 0 starts with the parent fields.
  const grid: Record<string, unknown>[] = Array.from({ length: totalRows }, () => ({}));
  Object.assign(grid[0], baseRow);

  // Place each sub-query: element[0] → row 0, overflow elements → consecutive rows
  // starting immediately after all previous sub-queries' overflow rows.
  let overflowStart = 1;
  for (const expansion of subQueryExpansions) {
    Object.assign(grid[0], expansion[0]);
    for (let j = 1; j < expansion.length; j++) {
      Object.assign(grid[overflowStart + j - 1], expansion[j]);
    }
    overflowStart += expansion.length - 1;
  }

  return grid;
};

const flattenRecord = (record: Record<string, unknown>): Record<string, unknown>[] =>
  flattenRecordWithSubQueryDepth(record, SUBQUERY_FLATTEN_MAX_DEPTH);

/** Registers one dotted column path, recursing into nested relationship objects. */
const addFieldPathForValue = (
  pathPrefix: string,
  val: unknown,
  addField: (name: string) => void
): void => {
  if (isNestedRelationshipObject(val)) {
    collectRelationshipFieldPaths(pathPrefix, val, addField, RELATIONSHIP_FLATTEN_MAX_DEPTH);
  } else {
    addField(pathPrefix);
  }
};

const collectSubQueryFieldPaths = (
  prefix: string,
  value: { totalSize: number; done: boolean; records: unknown[] },
  addField: (name: string) => void,
  depthRemaining: number
): void => {
  if (depthRemaining <= 0) {
    addField(prefix);
    return;
  }
  for (const subRecord of value.records) {
    if (!isRecord(subRecord)) {
      continue;
    }
    for (const [subKey, subValue] of Object.entries(subRecord)) {
      if (subKey === 'attributes') {
        continue;
      }
      const pathPrefix = `${prefix}.${subKey}`;
      if (isSubQueryResult(subValue)) {
        collectSubQueryFieldPaths(pathPrefix, subValue, addField, depthRemaining - 1);
      } else {
        addFieldPathForValue(pathPrefix, subValue, addField);
      }
    }
  }
};

/**
 * Gets all possible flattened field names by examining all records.
 * Preserves the original SELECT column order, including fields whose value is null
 * in early records (e.g. AnnualRevenue = null).
 *
 * Pass 1: build a stable base key order from all records and identify which keys
 * are relationship objects or sub-query results.
 * Pass 2: for each base key, expand relationship/sub-query keys into dot-notation
 * sub-fields, or emit plain keys as-is.
 */
const getAllFlattenedFields = (records: Record<string, unknown>[]): string[] => {
  // Pass 1: stable key order + relationship/sub-query detection
  const baseOrder: string[] = [];
  const seenBase = new Set<string>();
  const relationshipKeys = new Set<string>();
  const subQueryKeys = new Set<string>();

  for (const record of records) {
    for (const [key, value] of Object.entries(record)) {
      if (key === 'attributes') {
        continue;
      }
      if (!seenBase.has(key)) {
        baseOrder.push(key);
        seenBase.add(key);
      }
      if (isSubQueryResult(value)) {
        subQueryKeys.add(key);
      } else if (isRecord(value)) {
        relationshipKeys.add(key);
      }
    }
  }

  // Pass 2: expand relationship/sub-query keys; emit plain keys as-is
  const fieldOrder: string[] = [];
  const seenFields = new Set<string>();

  const addField = (name: string): void => {
    if (!seenFields.has(name)) {
      fieldOrder.push(name);
      seenFields.add(name);
    }
  };

  for (const key of baseOrder) {
    if (subQueryKeys.has(key)) {
      // Expand sub-record fields from every sub-query result for this key
      for (const record of records) {
        const value = record[key];
        if (isSubQueryResult(value)) {
          collectSubQueryFieldPaths(key, value, addField, SUBQUERY_FLATTEN_MAX_DEPTH);
        }
      }
    } else if (relationshipKeys.has(key)) {
      for (const record of records) {
        const value = record[key];
        if (isRecord(value)) {
          for (const nestedKey of Object.keys(value)) {
            if (nestedKey === 'attributes') {
              continue;
            }
            const pathPrefix = `${key}.${nestedKey}`;
            addFieldPathForValue(pathPrefix, value[nestedKey], addField);
          }
        }
      }
    } else {
      addField(key);
    }
  }

  return fieldOrder;
};

/** Top-level sub-query keys become column prefixes (`Contacts.` …) for CSV parent vs child columns. */
const getSubQueryKeyPrefixesFromRecords = (records: Record<string, unknown>[]): string[] => {
  const prefixes = new Set<string>();
  for (const record of records) {
    for (const [key, value] of Object.entries(record)) {
      if (key === 'attributes') {
        continue;
      }
      if (isSubQueryResult(value)) {
        prefixes.add(`${key}.`);
      }
    }
  }
  return [...prefixes];
};

const isEmptyCsvCell = (value: unknown): boolean => value === undefined || value === null || value === '';

/**
 * Within one parent record's flattened rows, repeat parent-column values on sub-query overflow rows
 * so CSV exports are fully denormalized (unlike the output-channel table, which blanks repeated parents).
 */
const fillParentColumnsForCsvChunk = (
  chunk: Record<string, unknown>[],
  parentFields: string[]
): Record<string, unknown>[] => {
  const carry: Record<string, unknown> = {};
  return chunk.map(row => {
    const out = { ...row };
    for (const field of parentFields) {
      if (isEmptyCsvCell(out[field]) && !isEmptyCsvCell(carry[field])) {
        out[field] = carry[field];
      }
    }
    for (const field of parentFields) {
      if (!isEmptyCsvCell(out[field])) {
        carry[field] = out[field];
      }
    }
    return out;
  });
};

/** Converts query records to CSV format (same row/column model as generateTableOutput). */
export const convertToCSV = (records: QueryResult['records']): string => {
  const model = buildFlattenedGridModel(records);
  if (!model) {
    return '';
  }
  const recs = records?.filter(isRecord) ?? [];
  const { flattenedFields } = model;
  const subPrefixes = getSubQueryKeyPrefixesFromRecords(recs);
  const parentFields = flattenedFields.filter(f => !subPrefixes.some(p => f.startsWith(p)));
  const rows = recs.flatMap(record =>
    fillParentColumnsForCsvChunk(flattenRecord(record), parentFields)
  );
  const header = flattenedFields.map(field => escapeCSVField(field)).join(',');
  const lines = rows.map(row =>
    flattenedFields.map(field => escapeCSVField(formatFieldValue(row[field]))).join(',')
  );
  return [header, ...lines].join('\n');
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

const DISPLAY_OBJECT_MAX_DEPTH = 10;

/**
 * Formats a value inside an object/array for display (shows `null` / `undefined` as words).
 */
const formatNestedDisplayValue = (value: unknown, depthRemaining: number): string => {
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return 'undefined';
  }
  if (value instanceof Date) {
    const dateStr = String(value);
    return dateStr.length > 50 ? `${dateStr.substring(0, 47)}...` : dateStr;
  }
  if (Array.isArray(value)) {
    const joined = value.map(v => formatNestedDisplayValue(v, depthRemaining)).join(',');
    return joined.length > 50 ? `${joined.substring(0, 47)}...` : joined;
  }
  if (typeof value === 'object' && isRecord(value)) {
    if (depthRemaining <= 0) {
      return '[Object]';
    }
    const entries = Object.entries(value).filter(([key]) => key !== 'attributes');
    if (entries.length === 0) {
      return '[Object]';
    }
    const joined = entries.map(([_key, val]) => formatNestedDisplayValue(val, depthRemaining - 1)).join(', ');
    return joined.length > 50 ? `${joined.substring(0, 47)}...` : joined;
  }
  const primitiveStr = String(value);
  return primitiveStr.length > 50 ? `${primitiveStr.substring(0, 47)}...` : primitiveStr;
};

/** Formats a field value for table display (recurses into nested plain objects). */
export const formatFieldValueForDisplay = (value: unknown, depthRemaining = DISPLAY_OBJECT_MAX_DEPTH): string => {
  if (value === null || value === undefined) {
    return '';
  }
  return formatNestedDisplayValue(value, depthRemaining);
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
