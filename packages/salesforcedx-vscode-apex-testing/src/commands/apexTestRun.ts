/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AsyncTestConfiguration, Progress, TestLevel, TestService } from '@salesforce/apex-node';
import { sfProjectPreconditionChecker } from '@salesforce/effect-ext-utils';
import { isNotUndefined } from 'effect/Predicate';
import { type CancellationToken, CancellationError, languages, ProgressLocation, window } from 'vscode';
import { Utils } from 'vscode-uri';
import { OUTPUT_CHANNEL } from '../channels';
import { APEX_TESTSUITE_EXT } from '../constants';
import { getConnection } from '../coreExtensionUtils';
import { nls } from '../messages';
import { getApexTestingRuntime } from '../services/extensionProvider';
import * as settings from '../settings';
import {
  type CancelResponse,
  type ContinueResponse,
  LibraryCommandletExecutor,
  type ParametersGatherer,
  SfCommandlet
} from '../utils/commandletHelpers';
import { ApexTestQuickPickItem, getTestInfo } from '../utils/fileHelpers';
import { getTestResultsFolder } from '../utils/pathHelpers';
import { findLocalApexClassAndTestSuiteUris } from '../utils/testUtils';
import { runApexTests } from './apexTestRunUtils';

/** Remove the extension from a filename */
const removeExtension = (filename: string, ext: string): string =>
  filename.endsWith(ext) ? filename.slice(0, -ext.length) : filename;

class TestsSelector implements ParametersGatherer<ApexTestQuickPickItem> {
  public async gather(): Promise<CancelResponse | ContinueResponse<ApexTestQuickPickItem>> {
    let fileItems: ApexTestQuickPickItem[];
    try {
      fileItems = await window.withProgress(
        {
          location: ProgressLocation.Notification,
          title: nls.localize('retrieving_tests_message'),
          cancellable: true
        },
        async (_progress, token) => {
          const { testSuiteUris, apexClassUris } = await findLocalApexClassAndTestSuiteUris();

          const apexClassItems = await Promise.all(
            apexClassUris.map(
              (uri): Promise<ApexTestQuickPickItem | undefined> => getTestInfo(uri).catch((): undefined => undefined)
            )
          );

          const items = [
            ...testSuiteUris.map(
              (testSuite): ApexTestQuickPickItem => ({
                label: removeExtension(Utils.basename(testSuite), APEX_TESTSUITE_EXT),
                description: testSuite.fsPath,
                type: 'Suite' as const
              })
            ),
            {
              label: nls.localize('apex_test_run_all_local_test_label'),
              description: nls.localize('apex_test_run_all_local_tests_description_text'),
              type: 'AllLocal' as const
            },
            {
              label: nls.localize('apex_test_run_all_test_label'),
              description: nls.localize('apex_test_run_all_tests_description_text'),
              type: 'All' as const
            },
            ...apexClassItems.filter(isNotUndefined)
          ];
          if (token.isCancellationRequested) {
            throw new CancellationError();
          }
          return items;
        }
      );
    } catch (e) {
      if (e instanceof CancellationError) {
        return { type: 'CANCEL' };
      }
      throw e;
    }

    const selection = await window.showQuickPick<ApexTestQuickPickItem>(fileItems);
    return selection ? { type: 'CONTINUE', data: selection } : { type: 'CANCEL' };
  }
}

export class ApexLibraryTestRunExecutor extends LibraryCommandletExecutor<ApexTestQuickPickItem> {
  protected cancellable: boolean = true;
  public static diagnostics = languages.createDiagnosticCollection('apex-testing-errors');

  constructor() {
    super(nls.localize('apex_test_run_text'), 'apex_test_run_library', OUTPUT_CHANNEL);
  }

  public async run(
    response: ContinueResponse<ApexTestQuickPickItem>,
    progress?: Progress<{ message?: string }>,
    token?: CancellationToken
  ): Promise<boolean> {
    const connection = await getConnection();
    const testService = new TestService(connection);
    const payload = await buildTestPayload(testService, response.data);

    const result = await getApexTestingRuntime().runPromise(
      runApexTests(
        {
          payload,
          outputDir: await getTestResultsFolder(),
          codeCoverage: settings.retrieveTestCodeCoverage(),
          concise: settings.retrieveTestRunConcise(),
          telemetryTrigger: 'quickPick'
        },
        progress,
        token
      )
    );

    return result !== undefined;
  }
}

export const apexTestRun = async () => {
  const commandlet = new SfCommandlet(sfProjectPreconditionChecker, new TestsSelector(), new ApexLibraryTestRunExecutor());
  await commandlet.run();
};

const buildTestPayload = async (
  testService: TestService,
  data: ApexTestQuickPickItem
): Promise<AsyncTestConfiguration> => {
  const testLevel = TestLevel.RunSpecifiedTests;
  switch (data.type) {
    case 'Class':
      return await testService.buildAsyncPayload(
        testLevel,
        undefined,
        data.label,
        undefined,
        undefined,
        !settings.retrieveTestCodeCoverage() // the setting enables code coverage, so we need to pass false to disable it
      );
    case 'Suite':
      return await testService.buildAsyncPayload(
        testLevel,
        undefined,
        undefined,
        data.label,
        undefined,
        !settings.retrieveTestCodeCoverage()
      );
    case 'AllLocal':
      return { testLevel: TestLevel.RunLocalTests };
    case 'All':
      return { testLevel: TestLevel.RunAllTestsInOrg };
    default:
      return { testLevel: TestLevel.RunAllTestsInOrg };
  }
};
