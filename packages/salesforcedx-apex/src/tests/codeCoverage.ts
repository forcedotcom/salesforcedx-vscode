/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection } from '@salesforce/core';
import {
  ApexCodeCoverage,
  ApexCodeCoverageAggregate,
  ApexOrgWideCoverage,
  CodeCoverageResult,
  PerClassCoverage
} from './types';
import * as util from 'util';
import { calculatePercentage, queryAll } from './utils';
import { QUERY_RECORD_LIMIT } from './constants';

export class CodeCoverage {
  public readonly connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Returns the string representation of the org wide coverage percentage for a given username connection from OrgWideCoverage entity
   * @returns Org wide coverage percentage for a given username connection
   */
  public async getOrgWideCoverage(): Promise<string> {
    const orgWideCoverageResult = (await this.connection.tooling.query(
      'SELECT PercentCovered FROM ApexOrgWideCoverage'
    )) as ApexOrgWideCoverage;

    if (orgWideCoverageResult.records.length === 0) {
      return '0%';
    }
    return `${orgWideCoverageResult.records[0].PercentCovered}%`;
  }

  /**
   * Returns the code coverage information for each Apex class covered by each Apex test method from ApexCodeCoverage entity
   * @param apexTestClassSet Set of Apex test classes
   * @returns The code coverage information associated with each Apex test class
   * NOTE: a test could cover more than one class, result map should contain a record for each covered class
   */
  public async getPerClassCodeCoverage(
    apexTestClassSet: Set<string>
  ): Promise<Map<string, PerClassCoverage[]>> {
    if (apexTestClassSet.size === 0) {
      return new Map();
    }

    const perClassCodeCovResults =
      await this.queryPerClassCodeCov(apexTestClassSet);

    const perClassCoverageMap = new Map<string, PerClassCoverage[]>();

    perClassCodeCovResults.forEach((chunk) => {
      chunk.records.forEach((item) => {
        const totalLines = item.NumLinesCovered + item.NumLinesUncovered;
        const percentage = calculatePercentage(
          item.NumLinesCovered,
          totalLines
        );

        const value = {
          apexClassOrTriggerName: item.ApexClassOrTrigger.Name,
          apexClassOrTriggerId: item.ApexClassOrTrigger.Id,
          apexTestClassId: item.ApexTestClassId,
          apexTestMethodName: item.TestMethodName,
          numLinesCovered: item.NumLinesCovered,
          numLinesUncovered: item.NumLinesUncovered,
          percentage,
          ...(item.Coverage ? { coverage: item.Coverage } : {})
        };
        const key = `${item.ApexTestClassId}-${item.TestMethodName}`;
        if (perClassCoverageMap.get(key)) {
          perClassCoverageMap.get(key).push(value);
        } else {
          perClassCoverageMap.set(
            `${item.ApexTestClassId}-${item.TestMethodName}`,
            [value]
          );
        }
      });
    });

    return perClassCoverageMap;
  }

  /**
   * Returns the aggregate code coverage information from ApexCodeCoverageAggregate entity for a given set of Apex classes
   * @param apexClassIdSet Set of ids for Apex classes
   * @returns The aggregate code coverage information for the given set of Apex classes
   */
  public async getAggregateCodeCoverage(apexClassIdSet: Set<string>): Promise<{
    codeCoverageResults: CodeCoverageResult[];
    totalLines: number;
    coveredLines: number;
  }> {
    if (apexClassIdSet.size === 0) {
      return { codeCoverageResults: [], totalLines: 0, coveredLines: 0 };
    }

    const codeCoverageAggregates =
      await this.queryAggregateCodeCov(apexClassIdSet);

    let totalLinesCovered = 0;
    let totalLinesUncovered = 0;

    const totalCodeCoverageResults: CodeCoverageResult[] = [];

    codeCoverageAggregates.forEach((chunk) => {
      const codeCoverageResults: CodeCoverageResult[] = chunk.records.map(
        (item) => {
          totalLinesCovered += item.NumLinesCovered;
          totalLinesUncovered += item.NumLinesUncovered;
          const totalLines = item.NumLinesCovered + item.NumLinesUncovered;
          const percentage = calculatePercentage(
            item.NumLinesCovered,
            totalLines
          );

          return {
            apexId: item.ApexClassOrTrigger.Id,
            name: item.ApexClassOrTrigger.Name,
            type: item.ApexClassOrTrigger.Id.startsWith('01p')
              ? 'ApexClass'
              : 'ApexTrigger',
            numLinesCovered: item.NumLinesCovered,
            numLinesUncovered: item.NumLinesUncovered,
            percentage,
            coveredLines: item.Coverage.coveredLines,
            uncoveredLines: item.Coverage.uncoveredLines
          };
        }
      );

      totalCodeCoverageResults.push(...codeCoverageResults);
    });

    return {
      codeCoverageResults: totalCodeCoverageResults,
      totalLines: totalLinesCovered + totalLinesUncovered,
      coveredLines: totalLinesCovered
    };
  }

  private async queryPerClassCodeCov(
    apexTestClassSet: Set<string>
  ): Promise<ApexCodeCoverage[]> {
    const perClassCodeCovQuery =
      'SELECT ApexTestClassId, ApexClassOrTrigger.Id, ApexClassOrTrigger.Name, TestMethodName, NumLinesCovered, NumLinesUncovered, Coverage FROM ApexCodeCoverage WHERE ApexTestClassId IN (%s)';
    return this.fetchResults(apexTestClassSet, perClassCodeCovQuery);
  }

  private async queryAggregateCodeCov(
    apexClassIdSet: Set<string>
  ): Promise<ApexCodeCoverageAggregate[]> {
    const codeCoverageQuery =
      'SELECT ApexClassOrTrigger.Id, ApexClassOrTrigger.Name, NumLinesCovered, NumLinesUncovered, Coverage FROM ApexCodeCoverageAggregate WHERE ApexClassorTriggerId IN (%s)';
    return this.fetchResults(apexClassIdSet, codeCoverageQuery);
  }

  private async fetchResults<
    T extends ApexCodeCoverage | ApexCodeCoverageAggregate
  >(idSet: Set<string>, selectQuery: string): Promise<T[]> {
    const queries = this.createQueries(selectQuery, idSet);

    const queryPromises = queries.map((query) => {
      // The query method returns a type QueryResult from jsforce
      // that has takes a type that extends the jsforce Record.
      // ApexCodeCoverageRecord and ApexCodeCoverageAggregateRecord
      // are the Records compatible types defined in this project.
      return queryAll(this.connection, query, true);
    });

    // Note here the result of the .all call is of type QueryResult<ApexCodeCoverageAggregateRecord | ApexCodeCoverageRecord>[]
    // Since QueryResult is compatible with ApexCodeCoverage and ApexCodeCoverageAggregate we can cast to T[]
    // and things work out.
    //TODO: figure out how to use the provided types from core instead of having to work around typescript here.
    return (await Promise.all(queryPromises)) as T[];
  }

  private createQueries(selectQuery: string, idSet: Set<string>): string[] {
    const idArray = [...idSet];
    const queries: string[] = [];
    for (let i = 0; i < idArray.length; i += QUERY_RECORD_LIMIT) {
      const recordSet: string[] = idArray
        .slice(i, i + QUERY_RECORD_LIMIT)
        .map((id) => `'${id}'`);

      const query: string = util.format(selectQuery, recordSet.join(','));
      queries.push(query);
    }

    return queries;
  }
}
