/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { LAST_EDITED_AT_METADATA, LAST_RUN_AT_METADATA } from './notebookSort';
import { withoutStaleFlag } from './queryFreshness';
import {
  QUERY_PLAN_MIME,
  QUERY_RESULT_MIME,
  QueryPlanViewModel,
  QueryResultViewModel
} from './queryResultOutput';

export const NOTEBOOK_TYPE = 'salesforce-soql-notebook';
export const NOTEBOOK_FORMAT_VERSION = 1;
export const USE_TOOLING_API_METADATA = 'useToolingApi';
export const INCLUDE_QUERY_PLAN_METADATA = 'includeQueryPlan';
export { LAST_EDITED_AT_METADATA, LAST_RUN_AT_METADATA };

const MARKUP: vscode.NotebookCellKind = 1;
const CODE: vscode.NotebookCellKind = 2;
const decoder = new TextDecoder();
const encoder = new TextEncoder();

type DiskQueryResultOutput = {
  mime: typeof QUERY_RESULT_MIME;
  data: QueryResultViewModel;
};

type DiskQueryPlanOutput = {
  mime: typeof QUERY_PLAN_MIME;
  data: QueryPlanViewModel;
};

type DiskCellOutput = DiskQueryResultOutput | DiskQueryPlanOutput;

type DiskCell = {
  kind: 'markup' | 'code';
  language: 'markdown' | 'soql';
  value: string;
  useToolingApi?: boolean;
  includeQueryPlan?: boolean;
  lastEditedAt?: number;
  lastRunAt?: number;
  outputs?: DiskCellOutput[];
};

type DiskNotebook = {
  version: typeof NOTEBOOK_FORMAT_VERSION;
  cells: DiskCell[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isQueryResultViewModel = (value: unknown): value is QueryResultViewModel => {
  if (!isRecord(value) || typeof value.totalSize !== 'number' || typeof value.done !== 'boolean') {
    return false;
  }
  if (!Array.isArray(value.records) || typeof value.queryText !== 'string' || !isRecord(value.columnData)) {
    return false;
  }
  return Array.isArray(value.columnData.columns) && Array.isArray(value.columnData.subTables);
};

const isQueryPlanViewModel = (value: unknown): value is QueryPlanViewModel =>
  isRecord(value) && typeof value.queryText === 'string' && Array.isArray(value.plans);

const decodePersistedOutput = (item: vscode.NotebookCellOutputItem): DiskCellOutput | undefined => {
  try {
    const parsed: unknown = JSON.parse(decoder.decode(item.data));
    if (item.mime === QUERY_RESULT_MIME && isQueryResultViewModel(parsed)) {
      const data = withoutStaleFlag(parsed);
      return isQueryResultViewModel(data) ? { mime: QUERY_RESULT_MIME, data } : undefined;
    }
    if (item.mime === QUERY_PLAN_MIME && isQueryPlanViewModel(parsed)) {
      const data = withoutStaleFlag(parsed);
      return isQueryPlanViewModel(data) ? { mime: QUERY_PLAN_MIME, data } : undefined;
    }
    return undefined;
  } catch {
    return undefined;
  }
};

const serializeCellOutputs = (outputs: readonly vscode.NotebookCellOutput[] | undefined): DiskCellOutput[] =>
  (outputs ?? []).flatMap(output => output.items.flatMap(item => {
    const decoded = decodePersistedOutput(item);
    return decoded ? [decoded] : [];
  }));

const parseCellOutputs = (value: unknown): DiskCellOutput[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const parsedOutputs: DiskCellOutput[] = [];
  value.forEach(output => {
    if (!isRecord(output)) {
      return;
    }
    if (output.mime === QUERY_RESULT_MIME && isQueryResultViewModel(output.data)) {
      parsedOutputs.push({ mime: QUERY_RESULT_MIME, data: output.data });
      return;
    }
    if (output.mime === QUERY_PLAN_MIME && isQueryPlanViewModel(output.data)) {
      parsedOutputs.push({ mime: QUERY_PLAN_MIME, data: output.data });
    }
  });
  return parsedOutputs;
};

const parseNotebook = (content: string): DiskNotebook => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Invalid SOQL notebook JSON');
  }

  if (!isRecord(parsed) || !Object.hasOwn(parsed, 'version')) {
    throw new Error('SOQL notebook version is required');
  }
  if (parsed.version !== NOTEBOOK_FORMAT_VERSION) {
    throw new Error(`Unsupported SOQL notebook version: ${String(parsed.version)}`);
  }

  const cells = Array.isArray(parsed.cells) ? parsed.cells : [];
  return {
    version: NOTEBOOK_FORMAT_VERSION,
    cells: cells.map(cell => {
      if (!isRecord(cell) || (cell.kind !== 'markup' && cell.kind !== 'code')) {
        const kind = isRecord(cell) ? cell.kind : undefined;
        throw new Error(`Unknown SOQL notebook cell kind: ${String(kind)}`);
      }
      const diskCell: DiskCell = {
        kind: cell.kind,
        language: cell.kind === 'markup' ? 'markdown' : 'soql',
        value: typeof cell.value === 'string' ? cell.value : ''
      };
      if (cell.kind === 'code' && cell.useToolingApi === true) {
        diskCell.useToolingApi = true;
      }
      if (cell.kind === 'code' && cell.includeQueryPlan === true) {
        diskCell.includeQueryPlan = true;
      }
      if (cell.kind === 'code' && typeof cell.lastEditedAt === 'number') {
        diskCell.lastEditedAt = cell.lastEditedAt;
      }
      if (cell.kind === 'code' && typeof cell.lastRunAt === 'number') {
        diskCell.lastRunAt = cell.lastRunAt;
      }
      const outputs = parseCellOutputs(cell.outputs);
      if (outputs.length > 0) {
        diskCell.outputs = outputs;
      }
      return diskCell;
    })
  };
};

const cellMetadata = (cell: DiskCell): { [key: string]: unknown } | undefined => {
  const metadata: { [key: string]: unknown } = {};
  if (cell.useToolingApi === true) {
    metadata[USE_TOOLING_API_METADATA] = true;
  }
  if (cell.includeQueryPlan === true) {
    metadata[INCLUDE_QUERY_PLAN_METADATA] = true;
  }
  if (typeof cell.lastEditedAt === 'number') {
    metadata[LAST_EDITED_AT_METADATA] = cell.lastEditedAt;
  }
  if (typeof cell.lastRunAt === 'number') {
    metadata[LAST_RUN_AT_METADATA] = cell.lastRunAt;
  }
  return Object.keys(metadata).length > 0 ? metadata : undefined;
};

const toNotebookCellData = (cell: DiskCell): vscode.NotebookCellData => {
  const cellData = new vscode.NotebookCellData(cell.kind === 'markup' ? MARKUP : CODE, cell.value, cell.language);
  cellData.metadata = cellMetadata(cell);
  if (cell.outputs && cell.outputs.length > 0) {
    cellData.outputs = cell.outputs.map(
      output => new vscode.NotebookCellOutput([vscode.NotebookCellOutputItem.json(output.data, output.mime)])
    );
  }
  return cellData;
};

export const deserializeSoqlNotebook = (content: Uint8Array): vscode.NotebookData => {
  const decoded = decoder.decode(content);
  const notebook = decoded.trim() === '' ? { version: NOTEBOOK_FORMAT_VERSION, cells: [] } : parseNotebook(decoded);
  return new vscode.NotebookData(notebook.cells.map(toNotebookCellData));
};

export const serializeSoqlNotebook = (data: vscode.NotebookData): Uint8Array =>
  encoder.encode(
    JSON.stringify({
      version: NOTEBOOK_FORMAT_VERSION,
      cells: data.cells.map(cell => {
        if (cell.kind !== MARKUP && cell.kind !== CODE) {
          throw new Error(`Unknown SOQL notebook cell kind: ${String(cell.kind)}`);
        }
        const diskCell: DiskCell = {
          kind: cell.kind === MARKUP ? 'markup' : 'code',
          language: cell.kind === MARKUP ? 'markdown' : 'soql',
          value: cell.value
        };
        if (cell.kind === CODE && cell.metadata?.[USE_TOOLING_API_METADATA] === true) {
          diskCell.useToolingApi = true;
        }
        if (cell.kind === CODE && cell.metadata?.[INCLUDE_QUERY_PLAN_METADATA] === true) {
          diskCell.includeQueryPlan = true;
        }
        if (cell.kind === CODE && typeof cell.metadata?.[LAST_EDITED_AT_METADATA] === 'number') {
          diskCell.lastEditedAt = cell.metadata[LAST_EDITED_AT_METADATA];
        }
        if (cell.kind === CODE && typeof cell.metadata?.[LAST_RUN_AT_METADATA] === 'number') {
          diskCell.lastRunAt = cell.metadata[LAST_RUN_AT_METADATA];
        }
        const outputs = serializeCellOutputs(cell.outputs);
        if (outputs.length > 0) {
          diskCell.outputs = outputs;
        }
        return diskCell;
      })
    } satisfies DiskNotebook)
  );

export class SoqlNotebookSerializer implements vscode.NotebookSerializer {
  public deserializeNotebook(content: Uint8Array): vscode.NotebookData {
    return deserializeSoqlNotebook(content);
  }

  public serializeNotebook(data: vscode.NotebookData): Uint8Array {
    return serializeSoqlNotebook(data);
  }
}
