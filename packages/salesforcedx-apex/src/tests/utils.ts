/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection } from '@salesforce/core';
import { NamespaceInfo } from './types';
import { QueryResult } from 'jsforce';

export function calculatePercentage(dividend: number, divisor: number): string {
  let percentage = '0%';
  if (dividend > 0) {
    const calcPct = ((dividend / divisor) * 100).toFixed();
    percentage = `${calcPct}%`;
  }
  return percentage;
}

export function stringify(jsonObj: object): string {
  return JSON.stringify(jsonObj, null, 2);
}

export async function queryNamespaces(
  connection: Connection
): Promise<NamespaceInfo[]> {
  const installedNsQuery = 'SELECT NamespacePrefix FROM PackageLicense';
  const installedNsPromise = connection.query(installedNsQuery);
  const orgNsQuery = 'SELECT NamespacePrefix FROM Organization';
  const orgNsPromise = connection.query(orgNsQuery);

  const allNamespaces = await Promise.all([installedNsPromise, orgNsPromise]);
  const installedNamespaces = allNamespaces[0].records.map((record) => {
    return { installedNs: true, namespace: record.NamespacePrefix };
  });
  const orgNamespaces = allNamespaces[1].records.map((record) => {
    return { installedNs: false, namespace: record.NamespacePrefix };
  });

  return [...orgNamespaces, ...installedNamespaces];
}

export const queryAll = async <T>(
  connection: Connection,
  query: string,
  tooling = false
): Promise<QueryResult<T>> => {
  const conn = tooling ? connection.tooling : connection;
  const allRecords: T[] = [];
  let result = await conn.query<T>(query);
  allRecords.push(...result.records);
  while (!result.done) {
    result = (await conn.queryMore(result.nextRecordsUrl)) as QueryResult<T>;
    allRecords.push(...result.records);
  }

  return {
    done: true,
    totalSize: allRecords.length,
    records: allRecords
  } as QueryResult<T>;
};
