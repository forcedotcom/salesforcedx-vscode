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
import { calculatePercentage } from './utils';

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

    const perClassCodeCovResuls = await this.queryPerClassCodeCov(
      apexTestClassSet
    );

    const perClassCoverageMap = new Map<string, PerClassCoverage[]>();
    perClassCodeCovResuls.records.forEach(item => {
      const totalLines = item.NumLinesCovered + item.NumLinesUncovered;
      const percentage = calculatePercentage(item.NumLinesCovered, totalLines);

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

    return perClassCoverageMap;
  }

  private async queryPerClassCodeCov(
    apexTestClassSet: Set<string>
  ): Promise<ApexCodeCoverage> {
    let str = '';
    apexTestClassSet.forEach(elem => {
      str += `'${elem}',`;
    });
    str = str.slice(0, -1);

    const perClassCodeCovQuery =
      'SELECT ApexTestClassId, ApexClassOrTrigger.Id, ApexClassOrTrigger.Name, TestMethodName, NumLinesCovered, NumLinesUncovered, Coverage FROM ApexCodeCoverage WHERE ApexTestClassId IN (%s)';
    const perClassCodeCovResuls = (await this.connection.tooling.query(
      util.format(perClassCodeCovQuery, `${str}`)
    )) as ApexCodeCoverage;
    return perClassCodeCovResuls;
  }

  /**
   * Returns the aggregate code coverage information from ApexCodeCoverageAggregate entity for a given set of Apex classes
   * @param apexClassIdSet Set of ids for Apex classes
   * @returns The aggregate code coverage information for the given set of Apex classes
   */
  public async getAggregateCodeCoverage(
    apexClassIdSet: Set<string>
  ): Promise<{
    codeCoverageResults: CodeCoverageResult[];
    totalLines: number;
    coveredLines: number;
  }> {
    if (apexClassIdSet.size === 0) {
      return { codeCoverageResults: [], totalLines: 0, coveredLines: 0 };
    }

    const codeCoverageResuls = await this.queryAggregateCodeCov(apexClassIdSet);

    let totalLinesCovered = 0;
    let totalLinesUncovered = 0;
    const codeCoverageResults: CodeCoverageResult[] = codeCoverageResuls.records.map(
      item => {
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

    return {
      codeCoverageResults,
      totalLines: totalLinesCovered + totalLinesUncovered,
      coveredLines: totalLinesCovered
    };
  }

  private async queryAggregateCodeCov(
    apexClassIdSet: Set<string>
  ): Promise<ApexCodeCoverageAggregate> {
    let str = '';
    apexClassIdSet.forEach(elem => {
      str += `'${elem}',`;
    });
    str = str.slice(0, -1);

    const codeCoverageQuery =
      'SELECT ApexClassOrTrigger.Id, ApexClassOrTrigger.Name, NumLinesCovered, NumLinesUncovered, Coverage FROM ApexCodeCoverageAggregate WHERE ApexClassorTriggerId IN (%s)';
    const codeCoverageResuls = (await this.connection.tooling.query(
      util.format(codeCoverageQuery, `${str}`)
    )) as ApexCodeCoverageAggregate;
    return codeCoverageResuls;
  }
}
