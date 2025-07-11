/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  ApexTestProgressValue,
  AsyncTestConfiguration,
  HumanReporter,
  Progress,
  ResultFormat,
  TestLevel,
  TestResult,
  TestService
} from '@salesforce/apex-node-bundle';
import {
  getRootWorkspacePath,
  hasRootWorkspace,
  LibraryCommandletExecutor,
  SFDX_FOLDER,
  SfCommandlet,
  SfWorkspaceChecker,
  getTestResultsFolder,
  CancelResponse,
  ContinueResponse,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode';
import { basename } from 'node:path';
import { languages, workspace, window, CancellationToken, QuickPickItem, Uri } from 'vscode';
import { channelService, OUTPUT_CHANNEL } from '../channels';
import { APEX_CLASS_EXT, APEX_TESTSUITE_EXT } from '../constants';
import { getVscodeCoreExtension } from '../coreExtensionUtils';
import { nls } from '../messages';
import * as settings from '../settings';
import { getTestInfo } from './readTestFile';

export enum TestType {
  All,
  AllLocal,
  Suite,
  Class
}
export type ApexTestQuickPickItem = QuickPickItem & {
  type: TestType;
};

const FILE_SEARCH_PATTERN = `{**/*${APEX_TESTSUITE_EXT},**/*${APEX_CLASS_EXT}}`;
class TestsSelector implements ParametersGatherer<ApexTestQuickPickItem> {
  public async gather(): Promise<CancelResponse | ContinueResponse<ApexTestQuickPickItem>> {
    const { testSuites, apexClasses } = (await workspace.findFiles(FILE_SEARCH_PATTERN, SFDX_FOLDER))
      .sort((a, b) => a.fsPath.localeCompare(b.fsPath))
      .reduce(
        (acc: { testSuites: Uri[]; apexClasses: Uri[] }, file) => {
          if (file.path.endsWith('.cls')) {
            acc.apexClasses.push(file);
          } else {
            acc.testSuites.push(file);
          }
          return acc;
        },
        { testSuites: [], apexClasses: [] }
      );

    const fileItems = [
      ...testSuites.map(testSuite => ({
        label: basename(testSuite.toString(), '.testSuite-meta.xml'),
        description: testSuite.fsPath,
        type: TestType.Suite
      })),
      {
        label: nls.localize('apex_test_run_all_local_test_label'),
        description: nls.localize('apex_test_run_all_local_tests_description_text'),
        type: TestType.AllLocal
      },
      {
        label: nls.localize('apex_test_run_all_test_label'),
        description: nls.localize('apex_test_run_all_tests_description_text'),
        type: TestType.All
      },
      ...(await Promise.all(apexClasses.map(getTestInfo))).filter(item => item !== undefined)
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
  public static diagnostics = languages.createDiagnosticCollection('apex-errors');

  constructor() {
    super(nls.localize('apex_test_run_text'), 'apex_test_run_library', OUTPUT_CHANNEL);
  }

  public async run(
    response: ContinueResponse<ApexTestQuickPickItem>,
    progress?: Progress<{
      message?: string | undefined;
      increment?: number | undefined;
    }>,
    token?: CancellationToken
  ): Promise<boolean> {
    const vscodeCoreExtension = await getVscodeCoreExtension();
    const connection = await vscodeCoreExtension.exports.WorkspaceContext.getInstance().getConnection();
    const testService = new TestService(connection);
    const codeCoverage = settings.retrieveTestCodeCoverage();

    const payload: AsyncTestConfiguration = await buildTestPayload(testService, response.data);

    const progressReporter: Progress<ApexTestProgressValue> = {
      report: value => {
        if (value.type === 'StreamingClientProgress' || value.type === 'FormatTestResultProgress') {
          progress?.report({ message: value.message });
        }
      }
    };
    // TODO: fix in apex-node W-18453221
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const result = (await testService.runTestAsynchronous(
      payload,
      codeCoverage,
      false,
      progressReporter,
      token
    )) as TestResult;

    if (token?.isCancellationRequested) {
      return false;
    }

    await testService.writeResultFiles(
      result,
      {
        resultFormats: [ResultFormat.json],
        dirPath: await getTempFolder()
      },
      codeCoverage
    );
    const humanOutput = new HumanReporter().format(result, codeCoverage);
    channelService.appendLine(humanOutput);
    return true;
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
    case TestType.Class:
      return await testService.buildAsyncPayload(testLevel, undefined, data.label);
    case TestType.Suite:
      return await testService.buildAsyncPayload(testLevel, undefined, undefined, data.label);
    case TestType.AllLocal:
      return { testLevel: TestLevel.RunLocalTests };
    case TestType.All:
      return { testLevel: TestLevel.RunAllTestsInOrg };
    default:
      return { testLevel: TestLevel.RunAllTestsInOrg };
  }
};
