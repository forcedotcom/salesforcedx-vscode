/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Connection } from '@salesforce/core';
import {
  SyncTestConfiguration,
  AsyncTestConfiguration,
  AsyncTestArrayConfiguration,
  ApexTestProgressValue,
  TestResult,
  OutputDirConfig,
  ResultFormat,
  TestLevel,
  TestItem,
  NamespaceInfo,
  TestSuiteMembershipRecord,
  TestRunIdResult
} from './types';
import { join } from 'path';
import { CancellationToken, Progress } from '../common';
import { nls } from '../i18n';
import { JUnitReporter, TapReporter } from '../reporters';
import { isValidApexClassID, queryNamespaces, stringify } from './utils';
import { createFiles } from '../utils/fileSystemHandler';
import { AsyncTests } from './asyncTests';
import { SyncTests } from './syncTests';
import { formatTestErrors } from './diagnosticUtil';
import { QueryResult } from '../utils/types';
import { elapsedTime } from '../utils/elapsedTime';

export class TestService {
  private readonly connection: Connection;
  private readonly asyncService: AsyncTests;
  private readonly syncService: SyncTests;

  constructor(connection: Connection) {
    this.connection = connection;
    this.syncService = new SyncTests(connection);
    this.asyncService = new AsyncTests(connection);
  }

  /**
   * Retrieve all suites in org
   * @returns list of Suites in org
   */
  @elapsedTime()
  public async retrieveAllSuites(): Promise<
    { id: string; TestSuiteName: string }[]
  > {
    const testSuiteRecords = (await this.connection.tooling.query(
      `SELECT id, TestSuiteName FROM ApexTestSuite`
    )) as QueryResult<{ id: string; TestSuiteName: string }>;

    return testSuiteRecords.records;
  }

  @elapsedTime()
  private async retrieveSuiteId(
    suitename: string
  ): Promise<string | undefined> {
    const suiteResult = (await this.connection.tooling.query(
      `SELECT id FROM ApexTestSuite WHERE TestSuiteName = '${suitename}'`
    )) as QueryResult;

    if (suiteResult.records.length === 0) {
      return undefined;
    }
    return suiteResult.records[0].Id;
  }

  /**
   * Retrive the ids for the given suites
   * @param suitenames names of suites
   * @returns Ids associated with each suite
   */
  @elapsedTime()
  private async getOrCreateSuiteIds(suitenames: string[]): Promise<string[]> {
    const suiteIds = suitenames.map(async (suite) => {
      const suiteId = await this.retrieveSuiteId(suite);

      if (suiteId === undefined) {
        const result = (await this.connection.tooling.create('ApexTestSuite', {
          TestSuiteName: suite
        })) as { id: string };
        return result.id;
      }
      return suiteId;
    });
    return await Promise.all(suiteIds);
  }

  /**
   * Retrieves the test classes in a given suite
   * @param suitename name of suite
   * @param suiteId id of suite
   * @returns list of test classes in the suite
   */
  @elapsedTime()
  public async getTestsInSuite(
    suitename?: string,
    suiteId?: string
  ): Promise<TestSuiteMembershipRecord[]> {
    if (suitename === undefined && suiteId === undefined) {
      throw new Error(nls.localize('suitenameErr'));
    }

    if (suitename) {
      suiteId = await this.retrieveSuiteId(suitename);
      if (suiteId === undefined) {
        throw new Error(nls.localize('missingSuiteErr'));
      }
    }
    const classRecords = (await this.connection.tooling.query(
      `SELECT ApexClassId FROM TestSuiteMembership WHERE ApexTestSuiteId = '${suiteId}'`
    )) as QueryResult<TestSuiteMembershipRecord>;

    return classRecords.records;
  }

  /**
   * Returns the associated Ids for each given Apex class
   * @param testClasses list of Apex class names
   * @returns the associated ids for each Apex class
   */
  @elapsedTime()
  public async getApexClassIds(testClasses: string[]): Promise<string[]> {
    const classIds = testClasses.map(async (testClass) => {
      const apexClass = (await this.connection.tooling.query(
        `SELECT id, name FROM ApexClass WHERE Name = '${testClass}'`
      )) as QueryResult;
      if (apexClass.records.length === 0) {
        throw new Error(nls.localize('missingTestClassErr', testClass));
      }
      return apexClass.records[0].Id;
    });
    return await Promise.all(classIds);
  }

  /**
   * Builds a test suite with the given test classes. Creates the test suite if it doesn't exist already
   * @param suitename name of suite
   * @param tests tests to be added to suite
   */
  @elapsedTime()
  public async buildSuite(
    suitename: string,
    testClasses: string[]
  ): Promise<void> {
    const testSuiteId = (await this.getOrCreateSuiteIds([suitename]))[0];

    const classesInSuite = await this.getTestsInSuite(undefined, testSuiteId);
    const testClassIds = await this.getApexClassIds(testClasses);

    await Promise.all(
      testClassIds.map(async (classId) => {
        const existingClass = classesInSuite.filter(
          (rec) => rec.ApexClassId === classId
        );

        const testClass = testClasses[testClassIds.indexOf(classId)];
        if (existingClass.length > 0) {
          console.log(nls.localize('testSuiteMsg', [testClass, suitename]));
        } else {
          await this.connection.tooling.create('TestSuiteMembership', {
            ApexClassId: classId,
            ApexTestSuiteId: testSuiteId
          });
          console.log(nls.localize('classSuiteMsg', [testClass, suitename]));
        }
      })
    );
  }

  /**
   * Synchronous Test Runs
   * @param options Synchronous Test Runs configuration
   * @param codeCoverage should report code coverage
   * @param token cancellation token
   */
  @elapsedTime()
  public async runTestSynchronous(
    options: SyncTestConfiguration,
    codeCoverage = false,
    token?: CancellationToken
  ): Promise<TestResult | TestRunIdResult> {
    return await this.syncService.runTests(options, codeCoverage, token);
  }

  /**
   * Asynchronous Test Runs
   * @param options test options
   * @param codeCoverage should report code coverage
   * @param immediatelyReturn should not wait for test run to complete, return test run id immediately
   * @param progress progress reporter
   * @param token cancellation token
   */
  @elapsedTime()
  public async runTestAsynchronous(
    options: AsyncTestConfiguration | AsyncTestArrayConfiguration,
    codeCoverage = false,
    immediatelyReturn = false,
    progress?: Progress<ApexTestProgressValue>,
    token?: CancellationToken
  ): Promise<TestResult | TestRunIdResult> {
    return await this.asyncService.runTests(
      options,
      codeCoverage,
      immediatelyReturn,
      progress,
      token
    );
  }

  /**
   * Report Asynchronous Test Run Results
   * @param testRunId test run id
   * @param codeCoverage should report code coverages
   * @param token cancellation token
   */
  @elapsedTime()
  public async reportAsyncResults(
    testRunId: string,
    codeCoverage = false,
    token?: CancellationToken
  ): Promise<TestResult> {
    return await this.asyncService.reportAsyncResults(
      testRunId,
      codeCoverage,
      token
    );
  }

  /**
   *
   * @param result test result
   * @param outputDirConfig config for result files
   * @param codeCoverage should report code coverage
   * @returns list of result files created
   */
  @elapsedTime()
  public async writeResultFiles(
    result: TestResult | TestRunIdResult,
    outputDirConfig: OutputDirConfig,
    codeCoverage = false
  ): Promise<string[]> {
    const { dirPath, resultFormats, fileInfos } = outputDirConfig;
    const fileMap: { path: string; content: string }[] = [];
    const testRunId = result.hasOwnProperty('summary')
      ? (result as TestResult).summary.testRunId
      : (result as TestRunIdResult).testRunId;

    fileMap.push({
      path: join(dirPath, 'test-run-id.txt'),
      content: testRunId
    });

    if (resultFormats) {
      if (!result.hasOwnProperty('summary')) {
        throw new Error(nls.localize('runIdFormatErr'));
      }
      result = result as TestResult;

      for (const format of resultFormats) {
        if (!(format in ResultFormat)) {
          throw new Error(nls.localize('resultFormatErr'));
        }

        switch (format) {
          case ResultFormat.json:
            fileMap.push({
              path: join(
                dirPath,
                testRunId ? `test-result-${testRunId}.json` : `test-result.json`
              ),
              content: stringify(result)
            });
            break;
          case ResultFormat.tap:
            const tapResult = new TapReporter().format(result);
            fileMap.push({
              path: join(dirPath, `test-result-${testRunId}-tap.txt`),
              content: tapResult
            });
            break;
          case ResultFormat.junit:
            const junitResult = new JUnitReporter().format(result);
            fileMap.push({
              path: join(
                dirPath,
                testRunId
                  ? `test-result-${testRunId}-junit.xml`
                  : `test-result-junit.xml`
              ),
              content: junitResult
            });
            break;
        }
      }
    }

    if (codeCoverage) {
      if (!result.hasOwnProperty('summary')) {
        throw new Error(nls.localize('covIdFormatErr'));
      }
      result = result as TestResult;
      const coverageRecords = result.tests.map((record) => {
        return record.perClassCoverage;
      });
      fileMap.push({
        path: join(dirPath, `test-result-${testRunId}-codecoverage.json`),
        content: stringify(coverageRecords)
      });
    }

    fileInfos?.forEach((fileInfo) => {
      fileMap.push({
        path: join(dirPath, fileInfo.filename),
        content:
          typeof fileInfo.content !== 'string'
            ? stringify(fileInfo.content)
            : fileInfo.content
      });
    });

    createFiles(fileMap);
    return fileMap.map((file) => {
      return file.path;
    });
  }

  // utils to build test run payloads that may contain namespaces
  @elapsedTime()
  public async buildSyncPayload(
    testLevel: TestLevel,
    tests?: string,
    classnames?: string
  ): Promise<SyncTestConfiguration> {
    try {
      if (tests) {
        const payload = await this.buildTestPayload(tests);
        const classes = payload.tests?.map((testItem) => {
          if (testItem.className) {
            return testItem.className;
          }
        });
        if (new Set(classes).size !== 1) {
          throw new Error(nls.localize('syncClassErr'));
        }
        return payload;
      } else if (classnames) {
        const prop = isValidApexClassID(classnames) ? 'classId' : 'className';
        return {
          tests: [{ [prop]: classnames }],
          testLevel
        };
      }
      throw new Error(nls.localize('payloadErr'));
    } catch (e) {
      throw formatTestErrors(e);
    }
  }

  @elapsedTime()
  public async buildAsyncPayload(
    testLevel: TestLevel,
    tests?: string,
    classNames?: string,
    suiteNames?: string
  ): Promise<AsyncTestConfiguration | AsyncTestArrayConfiguration> {
    try {
      if (tests) {
        return (await this.buildTestPayload(
          tests
        )) as AsyncTestArrayConfiguration;
      } else if (classNames) {
        return await this.buildAsyncClassPayload(classNames);
      } else {
        return {
          suiteNames,
          testLevel
        };
      }
    } catch (e) {
      throw formatTestErrors(e);
    }
  }

  @elapsedTime()
  private async buildAsyncClassPayload(
    classNames: string
  ): Promise<AsyncTestArrayConfiguration> {
    const classNameArray = classNames.split(',') as string[];
    const classItems = classNameArray.map((item) => {
      const classParts = item.split('.');
      if (classParts.length > 1) {
        return {
          className: `${classParts[0]}.${classParts[1]}`
        };
      }
      const prop = isValidApexClassID(item) ? 'classId' : 'className';
      return { [prop]: item } as TestItem;
    });
    return { tests: classItems, testLevel: TestLevel.RunSpecifiedTests };
  }

  @elapsedTime()
  private async buildTestPayload(
    testNames: string
  ): Promise<AsyncTestArrayConfiguration | SyncTestConfiguration> {
    const testNameArray = testNames.split(',');
    const testItems: TestItem[] = [];
    const classes: string[] = [];
    let namespaceInfos: NamespaceInfo[];

    for (const test of testNameArray) {
      if (test.indexOf('.') > 0) {
        const testParts = test.split('.');
        if (testParts.length === 3) {
          if (!classes.includes(testParts[1])) {
            testItems.push({
              namespace: `${testParts[0]}`,
              className: `${testParts[1]}`,
              testMethods: [testParts[2]]
            });
            classes.push(testParts[1]);
          } else {
            testItems.forEach((element) => {
              if (element.className === `${testParts[1]}`) {
                element.namespace = `${testParts[0]}`;
                element.testMethods.push(`${testParts[2]}`);
              }
            });
          }
        } else {
          if (typeof namespaceInfos === 'undefined') {
            namespaceInfos = await queryNamespaces(this.connection);
          }
          const currentNamespace = namespaceInfos.find(
            (namespaceInfo) => namespaceInfo.namespace === testParts[0]
          );
          // NOTE: Installed packages require the namespace to be specified as part of the className field
          // The namespace field should not be used with subscriber orgs
          if (currentNamespace) {
            if (currentNamespace.installedNs) {
              testItems.push({
                className: `${testParts[0]}.${testParts[1]}`
              });
            } else {
              testItems.push({
                namespace: `${testParts[0]}`,
                className: `${testParts[1]}`
              });
            }
          } else {
            if (!classes.includes(testParts[0])) {
              testItems.push({
                className: testParts[0],
                testMethods: [testParts[1]]
              });
              classes.push(testParts[0]);
            } else {
              testItems.forEach((element) => {
                if (element.className === testParts[0]) {
                  element.testMethods.push(testParts[1]);
                }
              });
            }
          }
        }
      } else {
        const prop = isValidApexClassID(test) ? 'classId' : 'className';
        testItems.push({ [prop]: test });
      }
    }
    return {
      tests: testItems,
      testLevel: TestLevel.RunSpecifiedTests
    };
  }
}
