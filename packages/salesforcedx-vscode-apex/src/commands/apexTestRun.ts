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
  SfWorkspaceChecker
} from '@salesforce/salesforcedx-utils-vscode';
import { getTestResultsFolder } from '@salesforce/salesforcedx-utils-vscode';
import { CancelResponse, ContinueResponse, ParametersGatherer } from '@salesforce/salesforcedx-utils-vscode';
import { readFileSync } from 'fs';
import { basename } from 'path';
import { languages, workspace, window, CancellationToken, QuickPickItem, Uri } from 'vscode';
import { channelService, OUTPUT_CHANNEL } from '../channels';
import { APEX_CLASS_EXT, APEX_TESTSUITE_EXT, IS_TEST_REG_EXP } from '../constants';
import { workspaceContext } from '../context';
import { nls } from '../messages';
import * as settings from '../settings';

export enum TestType {
  All,
  AllLocal,
  Suite,
  Class
}
export type ApexTestQuickPickItem = QuickPickItem & {
  type: TestType;
};

export class TestsSelector implements ParametersGatherer<ApexTestQuickPickItem> {
  public async gather(): Promise<CancelResponse | ContinueResponse<ApexTestQuickPickItem>> {
    const { testSuites, apexClasses } = (
      await workspace.findFiles(`{**/*${APEX_TESTSUITE_EXT},**/*${APEX_CLASS_EXT}}`, SFDX_FOLDER)
    )
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

    const fileItems = testSuites.map(testSuite => {
      return {
        label: basename(testSuite.toString(), '.testSuite-meta.xml'),
        description: testSuite.fsPath,
        type: TestType.Suite
      };
    });

    fileItems.push({
      label: nls.localize('apex_test_run_all_local_test_label'),
      description: nls.localize('apex_test_run_all_local_tests_description_text'),
      type: TestType.AllLocal
    });

    fileItems.push({
      label: nls.localize('apex_test_run_all_test_label'),
      description: nls.localize('apex_test_run_all_tests_description_text'),
      type: TestType.All
    });

    fileItems.push(
      ...apexClasses
        .filter(apexClass => {
          const fileContent = readFileSync(apexClass.fsPath, 'utf-8');
          return IS_TEST_REG_EXP.test(fileContent);
        })
        .map(apexClass => {
          return {
            label: basename(apexClass.toString(), APEX_CLASS_EXT),
            description: apexClass.fsPath,
            type: TestType.Class
          };
        })
    );

    const selection = (await window.showQuickPick(fileItems)) as ApexTestQuickPickItem;
    return selection ? { type: 'CONTINUE', data: selection } : { type: 'CANCEL' };
  }
}

const getTempFolder = (): string => {
  if (hasRootWorkspace()) {
    const apexDir = getTestResultsFolder(getRootWorkspacePath(), 'apex');
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
    const connection = await workspaceContext.getConnection();
    const testService = new TestService(connection);
    const testLevel = TestLevel.RunSpecifiedTests;
    const codeCoverage = settings.retrieveTestCodeCoverage();

    let payload: AsyncTestConfiguration;

    switch (response.data.type) {
      case TestType.Class:
        payload = await testService.buildAsyncPayload(testLevel, undefined, response.data.label);
        break;
      case TestType.Suite:
        payload = await testService.buildAsyncPayload(testLevel, undefined, undefined, response.data.label);
        break;
      case TestType.AllLocal:
        payload = { testLevel: TestLevel.RunLocalTests };
        break;
      case TestType.All:
        payload = { testLevel: TestLevel.RunAllTestsInOrg };
        break;
      default:
        payload = { testLevel: TestLevel.RunAllTestsInOrg };
    }

    const progressReporter: Progress<ApexTestProgressValue> = {
      report: value => {
        if (value.type === 'StreamingClientProgress' || value.type === 'FormatTestResultProgress') {
          progress?.report({ message: value.message });
        }
      }
    };
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
        dirPath: getTempFolder()
      },
      codeCoverage
    );
    const humanOutput = new HumanReporter().format(result, codeCoverage);
    channelService.appendLine(humanOutput);
    return true;
  }
}

const workspaceChecker = new SfWorkspaceChecker();
const parameterGatherer = new TestsSelector();

export const apexTestRun = async () => {
  const commandlet = new SfCommandlet(workspaceChecker, parameterGatherer, new ApexLibraryTestRunExecutor());
  await commandlet.run();
};
