/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { BaseCommand } from '@salesforce/salesforcedx-utils-vscode/out/src/requestService';
import { SOBJECTS_URL } from '../constants';

export interface ApexExecutionOverlayResultCommandFailure {
  message: string;
  errorCode: string;
}

export interface ApexExecutionOverlayResultCommandSuccess {
  attributes: Attributes;
  Id: string;
  IsDeleted: boolean;
  CreatedDate: Date;
  CreatedById: string;
  LastModifiedDate: Date;
  LastModifiedById: string;
  SystemModstamp: Date;
  UserId: string;
  RequestedById: string;
  OverlayResultLength: number;
  HeapDump: HeapDump;
  ApexResult: HeapDumpApexResult | null;
  SOQLResult: HeapDumpSOQLResult | null;
  Line: number;
  Iteration: number;
  ExpirationDate: Date;
  IsDumpingHeap: boolean;
  ActionScript: string | null;
  ActionScriptType: string;
  ClassName: string;
  Namespace: string;
}

export interface HeapDump {
  className: string;
  extents: HeapDumpExtents[];
  heapDumpDate: Date;
  namespace: string;
}

export interface HeapDumpExtents {
  collectionType: string | null;
  count: number;
  definition: HeapDumpCollectionTypeDefinition[];
  extent: HeapDumpExtent[];
  totalSize: number;
  typeName: string;
}

export interface HeapDumpCollectionTypeDefinition {
  name: string;
  type: string;
}

export interface HeapDumpExtent {
  address: string;
  size: number;
  symbols: string[] | null;
  value: HeapDumpExtentValue;
}

// The Extent value has to be an any. The value can be a single value of varying
// types or an array of values of varying types from a collection.
export interface HeapDumpExtentValue {
  value?: any;
  entry?: HeapDumpExtentValueEntry[];
}

export interface HeapDumpExtentValueEntry {
  keyDisplayValue: string;
  value: HeapDumpExtentValue;
}

export interface HeapDumpApexResult {
  apexError: string | null;
  apexExecutionResult: HeapDumpApexExecutionResult | null;
}

export interface HeapDumpApexExecutionResult {
  column: number;
  compileProblem: string | null;
  compiled: boolean;
  exceptionMessage: string | null;
  exceptionStackTrace: string | null;
  line: number;
  success: boolean;
}

// If the queryError is returned then the queryMetadata and queryResult will both be null.
export interface HeapDumpSOQLResult {
  queryError: string | null;
  queryMetadata: HeapDumpSOQLResultQueryMetadata | null;
  queryResult: HeapDumpSOQLResultQueryResult[] | null;
}

export interface HeapDumpSOQLResultQueryMetadata {
  columnMetadata: HeapDumpSOQLResultColumnMetadata[];
  entityName: string;
  groupBy: boolean;
  idSelected: boolean;
  keyPrefix: string;
}

export interface HeapDumpSOQLResultColumnMetadata {
  aggregate: boolean;
  apexType: string;
  booleanType: boolean;
  columnName: string;
  custom: boolean;
  displayName: string;
  foreignKeyName: string | null;
  insertable: boolean;
  joinColumns: string[];
  numberType: boolean;
  textType: boolean;
  updatable: boolean;
}

// A note about the HeapDumpSOQLResultQueryResult. The fields from a SOQL
// query will be the fields that the user asked for. For instance if Id,
// Name and AccountNumber were requested returns then the they'd be accessed
// through the HeapDumpSOQLResult.queryResult['Id'|'Name'|'AccountNumber'].
// The field name strings would be accessed through the ColumnMetadata returned
// with the query.
export interface HeapDumpSOQLResultQueryResult {
  attributes: Attributes;
  [fields: string]: any;
}

export interface Attributes {
  type: string;
  url: string;
}

export class ApexExecutionOverlayResultCommand extends BaseCommand {
  private readonly commandName = 'ApexExecutionOverlayResult';
  private readonly heapdumpKey: string;

  public constructor(heapdumpKey: string) {
    super(undefined);
    this.heapdumpKey = heapdumpKey;
  }

  public getCommandUrl(): string {
    const urlElements = [SOBJECTS_URL, this.commandName, this.heapdumpKey];
    return urlElements.join('/');
  }

  public getRequest(): string | undefined {
    return undefined;
  }
}
