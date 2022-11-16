/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection } from '@salesforce/core';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { expect } from 'chai';
import { createSandbox, SinonSandbox, SinonStub } from 'sinon';
import { CodeCoverage } from '../../src/tests/codeCoverage';
import {
  ApexCodeCoverageAggregate,
  ApexOrgWideCoverage,
  ApexCodeCoverage,
  ApexCodeCoverageRecord,
  ApexCodeCoverageAggregateRecord
} from '../../src/tests/types';
import { QUERY_RECORD_LIMIT } from '../../src/tests/constants';

const $$ = testSetup();
let mockConnection: Connection;
let sandboxStub: SinonSandbox;
let toolingQueryStub: SinonStub;
const testData = new MockTestOrgData();

describe('Get code coverage results', () => {
  beforeEach(async () => {
    sandboxStub = createSandbox();

    // Stub retrieveMaxApiVersion to get over "Domain Not Found: The org cannot be found" error
    sandboxStub
      .stub(Connection.prototype, 'retrieveMaxApiVersion')
      .resolves('50.0');
    await $$.stubAuths(testData);
    mockConnection = await testData.getConnection();
    toolingQueryStub = sandboxStub.stub(mockConnection.tooling, 'query');
  });

  afterEach(() => {
    sandboxStub.restore();
  });

  it('should return org wide coverage result', async () => {
    toolingQueryStub.onFirstCall().resolves({
      done: true,
      totalSize: 1,
      records: [
        {
          PercentCovered: '33'
        }
      ]
    } as ApexOrgWideCoverage);
    const codeCov = new CodeCoverage(mockConnection);

    const orgWideCoverageResult = await codeCov.getOrgWideCoverage();
    expect(orgWideCoverageResult).to.equal('33%');
  });

  it('should return 0% org wide coverage when no records are available', async () => {
    toolingQueryStub.onFirstCall().resolves({
      done: true,
      totalSize: 0,
      records: []
    } as ApexOrgWideCoverage);
    const codeCov = new CodeCoverage(mockConnection);

    const orgWideCoverageResult = await codeCov.getOrgWideCoverage();
    expect(orgWideCoverageResult).to.equal('0%');
    expect(toolingQueryStub.getCall(0).args[0]).to.equal(
      'SELECT PercentCovered FROM ApexOrgWideCoverage'
    );
  });

  it('should return aggregate code coverage result and testRunCoverage', async () => {
    const codeCoverageQueryResult = [
      {
        ApexClassOrTrigger: { Id: '0001x05958', Name: 'ApexTrigger1' },
        NumLinesCovered: 5,
        NumLinesUncovered: 1,
        Coverage: { coveredLines: [1, 2, 3, 4, 5], uncoveredLines: [6] }
      },
      {
        ApexClassOrTrigger: { Id: '0001x05959', Name: 'ApexTrigger2' },
        NumLinesCovered: 6,
        NumLinesUncovered: 2,
        Coverage: { coveredLines: [1, 2, 3, 4, 5, 6], uncoveredLines: [7, 8] }
      },
      {
        ApexClassOrTrigger: { Id: '0001x05951', Name: 'ApexTrigger3' },
        NumLinesCovered: 7,
        NumLinesUncovered: 3,
        Coverage: {
          coveredLines: [1, 2, 3, 4, 5, 6, 7],
          uncoveredLines: [8, 9, 10]
        }
      }
    ];

    const expectedResult = [
      {
        apexId: '0001x05958',
        coveredLines: [1, 2, 3, 4, 5],
        name: 'ApexTrigger1',
        numLinesCovered: 5,
        numLinesUncovered: 1,
        percentage: '83%',
        type: 'ApexTrigger',
        uncoveredLines: [6]
      },
      {
        apexId: '0001x05959',
        coveredLines: [1, 2, 3, 4, 5, 6],
        name: 'ApexTrigger2',
        numLinesCovered: 6,
        numLinesUncovered: 2,
        percentage: '75%',
        type: 'ApexTrigger',
        uncoveredLines: [7, 8]
      },
      {
        apexId: '0001x05951',
        coveredLines: [1, 2, 3, 4, 5, 6, 7],
        name: 'ApexTrigger3',
        numLinesCovered: 7,
        numLinesUncovered: 3,
        percentage: '70%',
        type: 'ApexTrigger',
        uncoveredLines: [8, 9, 10]
      }
    ];
    toolingQueryStub.resolves({
      done: true,
      totalSize: 3,
      records: codeCoverageQueryResult
    } as ApexCodeCoverageAggregate);
    const codeCov = new CodeCoverage(mockConnection);
    const {
      codeCoverageResults,
      totalLines,
      coveredLines
    } = await codeCov.getAggregateCodeCoverage(
      new Set<string>(['0001x05958', '0001x05959', '0001x05951'])
    );

    expect(totalLines).to.equal(24);
    expect(coveredLines).to.equal(18);
    expect(codeCoverageResults).to.eql(expectedResult);
  });

  it('should return aggregate code coverage result with 0 records', async () => {
    toolingQueryStub.throws('Error at Row:1;Column:1');

    const codeCov = new CodeCoverage(mockConnection);
    const {
      codeCoverageResults,
      totalLines,
      coveredLines
    } = await codeCov.getAggregateCodeCoverage(new Set([]));
    expect(codeCoverageResults.length).to.equal(0);
    expect(totalLines).to.equal(0);
    expect(coveredLines).to.equal(0);
  });

  it('should return per class code coverage for multiple test classes', async () => {
    const perClassCodeCovResult = [
      {
        ApexClassOrTrigger: { Id: '0001x05958', Name: 'ApexTrigger1' },
        TestMethodName: 'MethodOne',
        ApexTestClassId: '0001x05958',
        NumLinesCovered: 5,
        NumLinesUncovered: 1,
        Coverage: { coveredLines: [1, 2, 3, 4, 5], uncoveredLines: [6] }
      },
      {
        ApexClassOrTrigger: { Id: '0001x05959', Name: 'ApexTrigger2' },
        ApexTestClassId: '0001x05959',
        TestMethodName: 'MethodTwo',
        NumLinesCovered: 6,
        NumLinesUncovered: 2,
        Coverage: { coveredLines: [1, 2, 3, 4, 5, 6], uncoveredLines: [7, 8] }
      },
      {
        ApexClassOrTrigger: { Id: '0001x05951', Name: 'ApexTrigger3' },
        ApexTestClassId: '0001x05951',
        TestMethodName: 'MethodThree',
        NumLinesCovered: 7,
        NumLinesUncovered: 3,
        Coverage: {
          coveredLines: [1, 2, 3, 4, 5, 6, 7],
          uncoveredLines: [8, 9, 10]
        }
      }
    ];
    toolingQueryStub.resolves({
      done: true,
      totalSize: 3,
      records: perClassCodeCovResult
    } as ApexCodeCoverage);

    const codeCov = new CodeCoverage(mockConnection);
    const perClassCoverageMap = await codeCov.getPerClassCodeCoverage(
      new Set<string>(['0001x05958', '0001x05959', '0001x05951'])
    );
    expect(perClassCoverageMap.size).to.eql(3);
    expect(perClassCoverageMap.get('0001x05958-MethodOne')).to.deep.equal([
      {
        apexClassOrTriggerName: 'ApexTrigger1',
        apexClassOrTriggerId: '0001x05958',
        apexTestClassId: '0001x05958',
        apexTestMethodName: 'MethodOne',
        percentage: '83%',
        coverage: { coveredLines: [1, 2, 3, 4, 5], uncoveredLines: [6] },
        numLinesCovered: 5,
        numLinesUncovered: 1
      }
    ]);
    expect(perClassCoverageMap.get('0001x05959-MethodTwo')).to.deep.equal([
      {
        apexClassOrTriggerName: 'ApexTrigger2',
        apexClassOrTriggerId: '0001x05959',
        apexTestClassId: '0001x05959',
        apexTestMethodName: 'MethodTwo',
        percentage: '75%',
        coverage: {
          coveredLines: [1, 2, 3, 4, 5, 6],
          uncoveredLines: [7, 8]
        },
        numLinesCovered: 6,
        numLinesUncovered: 2
      }
    ]);
    expect(perClassCoverageMap.get('0001x05951-MethodThree')).to.deep.equal([
      {
        apexClassOrTriggerName: 'ApexTrigger3',
        apexClassOrTriggerId: '0001x05951',
        apexTestClassId: '0001x05951',
        apexTestMethodName: 'MethodThree',
        percentage: '70%',
        coverage: {
          coveredLines: [1, 2, 3, 4, 5, 6, 7],
          uncoveredLines: [8, 9, 10]
        },
        numLinesCovered: 7,
        numLinesUncovered: 3
      }
    ]);
  });

  it('should return per class code coverage for test that covers multiple classes', async () => {
    const perClassCodeCovResult = [
      {
        ApexClassOrTrigger: { Id: '0001x05958', Name: 'ApexTrigger1' },
        TestMethodName: 'MethodOne',
        ApexTestClassId: '0001x05958',
        NumLinesCovered: 5,
        NumLinesUncovered: 1,
        Coverage: { coveredLines: [1, 2, 3, 4, 5], uncoveredLines: [6] }
      },
      {
        ApexClassOrTrigger: { Id: '0001x05959', Name: 'ApexTrigger2' },
        ApexTestClassId: '0001x05958',
        TestMethodName: 'MethodOne',
        NumLinesCovered: 6,
        NumLinesUncovered: 2,
        Coverage: { coveredLines: [1, 2, 3, 4, 5, 6], uncoveredLines: [7, 8] }
      }
    ];
    toolingQueryStub.resolves({
      done: true,
      totalSize: 2,
      records: perClassCodeCovResult
    } as ApexCodeCoverage);

    const codeCov = new CodeCoverage(mockConnection);
    const perClassCoverageMap = await codeCov.getPerClassCodeCoverage(
      new Set<string>(['0001x05958'])
    );
    expect(perClassCoverageMap.size).to.eql(1);
    expect(perClassCoverageMap.get('0001x05958-MethodOne')).to.deep.equal([
      {
        apexClassOrTriggerName: 'ApexTrigger1',
        apexClassOrTriggerId: '0001x05958',
        apexTestClassId: '0001x05958',
        apexTestMethodName: 'MethodOne',
        percentage: '83%',
        coverage: { coveredLines: [1, 2, 3, 4, 5], uncoveredLines: [6] },
        numLinesCovered: 5,
        numLinesUncovered: 1
      },
      {
        apexClassOrTriggerName: 'ApexTrigger2',
        apexClassOrTriggerId: '0001x05959',
        apexTestClassId: '0001x05958',
        apexTestMethodName: 'MethodOne',
        percentage: '75%',
        coverage: {
          coveredLines: [1, 2, 3, 4, 5, 6],
          uncoveredLines: [7, 8]
        },
        numLinesCovered: 6,
        numLinesUncovered: 2
      }
    ]);
  });

  it('should return per class coverage for test that covers 0 classes', async () => {
    toolingQueryStub.throws('Error at Row:1;Column:1');
    const codeCov = new CodeCoverage(mockConnection);
    const perClassCoverageMap = await codeCov.getPerClassCodeCoverage(
      new Set<string>([])
    );

    expect(perClassCoverageMap.size).to.equal(0);
  });

  it('should split the PerClassCodeCoverage queue into chunks of 500 records', async () => {
    const queryStart =
      'SELECT ApexTestClassId, ApexClassOrTrigger.Id, ApexClassOrTrigger.Name, TestMethodName, NumLinesCovered, NumLinesUncovered, Coverage FROM ApexCodeCoverage WHERE ApexTestClassId IN ';
    const queryStartSeparatorCount = queryStart.split(',').length - 1;
    const recordCount = 1400;

    const records: ApexCodeCoverageRecord[] = [];
    for (let i = 0; i < recordCount; i++) {
      const record = {
        ApexClassOrTrigger: {
          Id: `01p30000000DRIQAA4-${i}`,
          Name: `apexClassName-${i}`
        },
        ApexTestClassId: `01p30000000DRIQAA4-${i}`,
        NumLinesCovered: 100,
        NumLinesUncovered: 0,
        TestMethodName: `testMethodName-${i}`
      };
      records.push(record);
    }

    toolingQueryStub.onFirstCall().resolves({
      done: true,
      totalSize: 1,
      records: records.splice(0, QUERY_RECORD_LIMIT)
    });

    toolingQueryStub.onSecondCall().resolves({
      done: true,
      totalSize: 1,
      records: records.splice(QUERY_RECORD_LIMIT, 2 * QUERY_RECORD_LIMIT)
    });

    toolingQueryStub.onThirdCall().resolves({
      done: true,
      totalSize: 1,
      records: records.splice(2 * QUERY_RECORD_LIMIT, recordCount)
    });

    const apexTestClassSet: Set<string> = new Set<string>();
    for (let i = 0; i < recordCount; i++) {
      apexTestClassSet.add(`01p30000000DRIQAA4-${i}`);
    }

    const codeCoverage = new CodeCoverage(mockConnection);
    await codeCoverage.getPerClassCodeCoverage(apexTestClassSet);

    expect(toolingQueryStub.args.length).to.equal(3);

    const idCountOfFirstCall =
      toolingQueryStub.getCall(0).args[0].split(',').length -
      queryStartSeparatorCount;
    expect(idCountOfFirstCall).to.equal(QUERY_RECORD_LIMIT);

    const idCountOfSecondCall =
      toolingQueryStub.getCall(1).args[0].split(',').length -
      queryStartSeparatorCount;
    expect(idCountOfSecondCall).to.equal(QUERY_RECORD_LIMIT);

    const idCountOfThirdCall =
      toolingQueryStub.getCall(2).args[0].split(',').length -
      queryStartSeparatorCount;
    expect(idCountOfThirdCall).to.equal(400);

    expect(
      idCountOfFirstCall + idCountOfSecondCall + idCountOfThirdCall
    ).to.equal(recordCount);
  });

  it('should split the AggregateCodeCoverage queue into chunks of 500 records', async () => {
    const queryStart =
      'SELECT ApexClassOrTrigger.Id, ApexClassOrTrigger.Name, NumLinesCovered, NumLinesUncovered, Coverage FROM ApexCodeCoverageAggregate WHERE ApexClassorTriggerId IN ';
    const queryStartSeparatorCount = queryStart.split(',').length - 1;
    const recordCount = 1300;

    const records: ApexCodeCoverageAggregateRecord[] = [];
    for (let i = 0; i < recordCount; i++) {
      const record = {
        NumLinesCovered: 0,
        NumLinesUncovered: 0,
        ApexClassOrTrigger: {
          Id: '',
          Name: ''
        },
        Coverage: {
          coveredLines: [1, 2, 3],
          uncoveredLines: [4, 5, 6]
        }
      };
      records.push(record);
    }

    toolingQueryStub.onFirstCall().resolves({
      done: true,
      totalSize: 1,
      records: records.splice(0, QUERY_RECORD_LIMIT)
    });

    toolingQueryStub.onSecondCall().resolves({
      done: true,
      totalSize: 1,
      records: records.splice(QUERY_RECORD_LIMIT, 2 * QUERY_RECORD_LIMIT)
    });

    toolingQueryStub.onThirdCall().resolves({
      done: true,
      totalSize: 1,
      records: records.splice(2 * QUERY_RECORD_LIMIT, recordCount)
    });

    const apexTestClassSet: Set<string> = new Set<string>();
    for (let i = 0; i < recordCount; i++) {
      apexTestClassSet.add(`01p30000000DRIQAA4-${i}`);
    }

    const codeCoverage = new CodeCoverage(mockConnection);
    await codeCoverage.getAggregateCodeCoverage(apexTestClassSet);

    expect(toolingQueryStub.args.length).to.equal(3);

    const idCountOfFirstCall =
      toolingQueryStub.getCall(0).args[0].split(',').length -
      queryStartSeparatorCount;
    expect(idCountOfFirstCall).to.equal(QUERY_RECORD_LIMIT);

    const idCountOfSecondCall =
      toolingQueryStub.getCall(1).args[0].split(',').length -
      queryStartSeparatorCount;
    expect(idCountOfSecondCall).to.equal(QUERY_RECORD_LIMIT);

    const idCountOfThirdCall =
      toolingQueryStub.getCall(2).args[0].split(',').length -
      queryStartSeparatorCount;
    expect(idCountOfThirdCall).to.equal(300);

    expect(
      idCountOfFirstCall + idCountOfSecondCall + idCountOfThirdCall
    ).to.equal(recordCount);
  });
});
