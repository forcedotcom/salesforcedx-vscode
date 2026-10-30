/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';

export const LogLevelSchema = Schema.Literal('trace', 'debug', 'info', 'warn', 'error', 'fatal').annotations({
  identifier: 'LogLevel'
});
export type LogLevel = typeof LogLevelSchema.Type;

export const xmlCharMap: { [index: string]: string } = {
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  '"': '&quot;',
  "'": '&apos;'
};

export const CommonOptionsSchema = Schema.Struct({
  json: Schema.optional(Schema.Boolean),
  loglevel: Schema.optional(LogLevelSchema)
}).annotations({ identifier: 'CommonOptions' });
export type CommonOptions = typeof CommonOptionsSchema.Type;

export type { ApexDiagnostic } from '../effect/diagnostics';

export type QueryRecords = {
  totalSize: number;
  records: IdRecord[];
};

type DebugLevelRecord = {
  ApexCode: string;
  VisualForce: string;
};

export type TraceFlagRecord = {
  Id: string;
  LogType: string;
  DebugLevelId: string;
  StartDate: Date | undefined;
  ExpirationDate: Date | undefined;
  DebugLevel: DebugLevelRecord;
};

export type DataRecordResult = {
  id?: string;
  errors?: string[];
  success: boolean;
};

export type IdRecord = {
  Id: string;
};

export interface Row {
  [column: string]: string;
}

export interface Column {
  key: string;
  label: string;
}
