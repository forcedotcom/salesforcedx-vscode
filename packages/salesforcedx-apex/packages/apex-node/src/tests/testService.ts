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
  NamespaceInfo
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
   * Synchronous Test Runs
   * @param options Synchronous Test Runs configuration
   * @param codeCoverage should report code coverage
   * @param token cancellation token
   */
  public async runTestSynchronous(
    options: SyncTestConfiguration,
    codeCoverage = false,
    token?: CancellationToken
  ): Promise<TestResult> {
    return await this.syncService.runTests(options, codeCoverage, token);
  }

  /**
   * Asynchronous Test Runs
   * @param options test options
   * @param codeCoverage should report code coverage
   * @param progress progress reporter
   * @param token cancellation token
   */
  public async runTestAsynchronous(
    options: AsyncTestConfiguration | AsyncTestArrayConfiguration,
    codeCoverage = false,
    progress?: Progress<ApexTestProgressValue>,
    token?: CancellationToken
  ): Promise<TestResult> {
    return await this.asyncService.runTests(
      options,
      codeCoverage,
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
  public async writeResultFiles(
    result: TestResult,
    outputDirConfig: OutputDirConfig,
    codeCoverage = false
  ): Promise<string[]> {
    const { dirPath, resultFormats, fileInfos } = outputDirConfig;
    const fileMap: { path: string; content: string }[] = [];

    fileMap.push({
      path: join(dirPath, 'test-run-id.txt'),
      content: result.summary.testRunId
    });

    if (resultFormats) {
      for (const format of resultFormats) {
        if (!(format in ResultFormat)) {
          throw new Error(nls.localize('resultFormatErr'));
        }

        switch (format) {
          case ResultFormat.json:
            fileMap.push({
              path: join(
                dirPath,
                result.summary.testRunId
                  ? `test-result-${result.summary.testRunId}.json`
                  : `test-result.json`
              ),
              content: stringify(result)
            });
            break;
          case ResultFormat.tap:
            const tapResult = new TapReporter().format(result);
            fileMap.push({
              path: join(
                dirPath,
                `test-result-${result.summary.testRunId}-tap.txt`
              ),
              content: tapResult
            });
            break;
          case ResultFormat.junit:
            const junitResult = new JUnitReporter().format(result);
            fileMap.push({
              path: join(
                dirPath,
                result.summary.testRunId
                  ? `test-result-${result.summary.testRunId}-junit.xml`
                  : `test-result-junit.xml`
              ),
              content: junitResult
            });
            break;
        }
      }
    }

    if (codeCoverage) {
      const coverageRecords = result.tests.map(record => {
        return record.perClassCoverage;
      });
      fileMap.push({
        path: join(
          dirPath,
          `test-result-${result.summary.testRunId}-codecoverage.json`
        ),
        content: stringify(coverageRecords)
      });
    }

    fileInfos?.forEach(fileInfo => {
      fileMap.push({
        path: join(dirPath, fileInfo.filename),
        content:
          typeof fileInfo.content !== 'string'
            ? stringify(fileInfo.content)
            : fileInfo.content
      });
    });

    createFiles(fileMap);
    return fileMap.map(file => {
      return file.path;
    });
  }

  // utils to build test run payloads that may contain namespaces
  public async buildSyncPayload(
    testLevel: TestLevel,
    tests?: string,
    classnames?: string
  ): Promise<SyncTestConfiguration> {
    try {
      if (tests) {
        const payload = await this.buildTestPayload(tests);
        const classes = payload.tests?.map(testItem => {
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

  private async buildAsyncClassPayload(
    classNames: string
  ): Promise<AsyncTestArrayConfiguration> {
    const classNameArray = classNames.split(',') as string[];
    const classItems = classNameArray.map(item => {
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

  private async buildTestPayload(
    testNames: string
  ): Promise<AsyncTestArrayConfiguration | SyncTestConfiguration> {
    const testNameArray = testNames.split(',');
    const testItems: TestItem[] = [];
    let namespaceInfos: NamespaceInfo[];

    for (const test of testNameArray) {
      if (test.indexOf('.') > 0) {
        const testParts = test.split('.');
        if (testParts.length === 3) {
          testItems.push({
            namespace: `${testParts[0]}`,
            className: `${testParts[1]}`,
            testMethods: [testParts[2]]
          });
        } else {
          if (typeof namespaceInfos === 'undefined') {
            namespaceInfos = await queryNamespaces(this.connection);
          }
          const currentNamespace = namespaceInfos.find(
            namespaceInfo => namespaceInfo.namespace === testParts[0]
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
            testItems.push({
              className: testParts[0],
              testMethods: [testParts[1]]
            });
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
