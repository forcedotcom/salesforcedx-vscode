/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

type Attributes = {
  type: string;
  url: string;
};

export type ApexExecutionOverlayResultCommandSuccess = {
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
};

type HeapDump = {
  className: string;
  extents: HeapDumpExtents[];
  heapDumpDate: Date;
  namespace: string;
};

export type HeapDumpExtents = {
  collectionType: string | null;
  count: number;
  definition: HeapDumpCollectionTypeDefinition[];
  extent: HeapDumpExtent[];
  totalSize: number;
  typeName: string;
};

type HeapDumpCollectionTypeDefinition = {
  name: string;
  type: string;
};

type HeapDumpExtent = {
  address: string;
  size: number;
  isStatic: boolean;
  symbols: string[] | null;
  value: HeapDumpExtentValue;
};

// The Extent value has to be an any. The value can be a single value of varying
// types or an array of values of varying types from a collection.
export type HeapDumpExtentValue = {
  value?: any;
  entry?: HeapDumpExtentValueEntry[];
};

type HeapDumpExtentValueEntry = {
  keyDisplayValue: string;
  value: HeapDumpExtentValue;
};

type HeapDumpApexResult = {
  apexError: string | null;
  apexExecutionResult: HeapDumpApexExecutionResult | null;
};

type HeapDumpApexExecutionResult = {
  column: number;
  compileProblem: string | null;
  compiled: boolean;
  exceptionMessage: string | null;
  exceptionStackTrace: string | null;
  line: number;
  success: boolean;
};

// If the queryError is returned then the queryMetadata and queryResult will both be null.
type HeapDumpSOQLResult = {
  queryError: string | null;
  queryMetadata: HeapDumpSOQLResultQueryMetadata | null;
  queryResult: HeapDumpSOQLResultQueryResult[] | null;
};

type HeapDumpSOQLResultQueryMetadata = {
  columnMetadata: HeapDumpSOQLResultColumnMetadata[];
  entityName: string;
  groupBy: boolean;
  idSelected: boolean;
  keyPrefix: string;
};

type HeapDumpSOQLResultColumnMetadata = {
  aggregate: boolean;
  apexType: string;
  booleanType: boolean;
  columnName: string;
  custom: boolean;
  displayName: string;
  foreignKeyName: string | null;
  insertable: boolean;
  joinColumns: HeapDumpSOQLResultJoinColumn[];
  numberType: boolean;
  textType: boolean;
  updatable: boolean;
};

type HeapDumpSOQLResultJoinColumn = {
  aggregate: boolean;
  apexType: string;
  booleanType: boolean;
  columnName: string;
  custom: boolean;
  displayName: string;
  foreignKeyName: string | null;
  insertable: boolean;
  numberType: boolean;
  textType: boolean;
  updatable: boolean;
};

type HeapDumpSOQLResultQueryResult = {
  attributes: Attributes;
};
