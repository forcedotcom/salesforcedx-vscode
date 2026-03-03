/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AsyncTestConfiguration, Progress, TestLevel, TestService } from '@salesforce/apex-node';
import { isNotUndefined } from 'effect/Predicate';
import { type CancellationToken, languages, Uri, window } from 'vscode';
import { Utils } from 'vscode-uri';
import { OUTPUT_CHANNEL } from '../channels';
import { APEX_CLASS_EXT, APEX_TESTSUITE_EXT } from '../constants';
import { getConnection } from '../coreExtensionUtils';
import { nls } from '../messages';
import * as settings from '../settings';
import {
  type CancelResponse,
  type ContinueResponse,
  getRootWorkspacePath,
  hasRootWorkspace,
  LibraryCommandletExecutor,
  type ParametersGatherer,
  SfCommandlet,
  SfWorkspaceChecker
} from '../utils/commandletHelpers';
import { ApexTestQuickPickItem, getTestInfo } from '../utils/fileHelpers';
import { getTestResultsFolder } from '../utils/pathHelpers';
import { findFilesByExtensionsWeb, findLocalApexClassAndTestSuiteUris } from '../utils/testUtils';
import { runApexTests } from './apexTestRunUtils';

/** Remove the extension from a filename */
const removeExtension = (filename: string, ext: string): string =>
  filename.endsWith(ext) ? filename.slice(0, -ext.length) : filename;

/** Get test suite and apex class URIs via ComponentSetService; fallback to FsService walk (web only) when empty */
const findApexRunFiles = async (): Promise<{ testSuites: Uri[]; apexClasses: Uri[] }> => {
  const fromComponentSet = await findLocalApexClassAndTestSuiteUris();
  if (fromComponentSet.apexClassUris.length > 0 || fromComponentSet.testSuiteUris.length > 0) {
    return {
      testSuites: fromComponentSet.testSuiteUris,
      apexClasses: fromComponentSet.apexClassUris
    };
  }
  if (process.env.ESBUILD_PLATFORM === 'web') {
    const all = await findFilesByExtensionsWeb(getRootWorkspacePath(), [
      APEX_CLASS_EXT,
      APEX_TESTSUITE_EXT
    ]);
    const { testSuites = [], apexClasses = [] } = Object.groupBy(all, file =>
      file.path.endsWith(APEX_CLASS_EXT) ? 'apexClasses' : 'testSuites'
    );
    return { testSuites: testSuites ?? [], apexClasses: apexClasses ?? [] };
  }
  return { testSuites: [], apexClasses: [] };
};

class TestsSelector implements ParametersGatherer<ApexTestQuickPickItem> {
  public async gather(): Promise<CancelResponse | ContinueResponse<ApexTestQuickPickItem>> {
    const { testSuites, apexClasses } = await findApexRunFiles();

    const apexClassItems = await Promise.all(
      apexClasses.map((uri): Promise<ApexTestQuickPickItem | undefined> =>
        getTestInfo(uri).catch((): undefined => undefined)
      )
    );

    const fileItems = [
      ...testSuites.map(
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

    const selection = await window.showQuickPick<ApexTestQuickPickItem>(fileItems);
    return selection ? { type: 'CONTINUE', data: selection } : { type: 'CANCEL' };
  }
}

const getTempFolder = async (): Promise<string> => {
  if (hasRootWorkspace()) {
    const apexDir = await getTestResultsFolder(getRootWorkspacePath(), 'apex');
    return apexDir;
  } else {
    throw new Error(nls.localize('cannot_determine_workspace'));
  }
};

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

    const result = await runApexTests(
      {
        payload,
        outputDir: await getTempFolder(),
        codeCoverage: settings.retrieveTestCodeCoverage(),
        concise: settings.retrieveTestRunConcise(),
        telemetryTrigger: 'quickPick'
      },
      progress,
      token
    );

    return result !== undefined;
  }
}

export const apexTestRun = async () => {
  const commandlet = new SfCommandlet(new SfWorkspaceChecker(), new TestsSelector(), new ApexLibraryTestRunExecutor());
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
