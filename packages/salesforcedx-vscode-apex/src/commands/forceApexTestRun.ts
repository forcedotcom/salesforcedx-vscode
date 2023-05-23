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
} from '@salesforce/apex-node';
import {
  LibraryCommandletExecutor,
  SfdxCommandlet,
  SfdxWorkspaceChecker,
  workspaceUtils
} from '@salesforce/salesforcedx-utils-vscode';
import { getTestResultsFolder } from '@salesforce/salesforcedx-utils-vscode';
import {
  CancelResponse,
  ContinueResponse,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { channelService, OUTPUT_CHANNEL } from '../channels';
import { workspaceContext } from '../context';
import { nls } from '../messages';
import * as settings from '../settings';

export enum TestType {
  All,
  AllLocal,
  Suite,
  Class
}
export interface ApexTestQuickPickItem extends vscode.QuickPickItem {
  type: TestType;
}
export class TestsSelector
  implements ParametersGatherer<ApexTestQuickPickItem> {
  public async gather(): Promise<
    CancelResponse | ContinueResponse<ApexTestQuickPickItem>
  > {
    const testSuites = await vscode.workspace.findFiles(
      '**/*.testSuite-meta.xml'
    );
    const fileItems = testSuites.map(testSuite => {
      return {
        label: path
          .basename(testSuite.toString())
          .replace('.testSuite-meta.xml', ''),
        description: testSuite.fsPath,
        type: TestType.Suite
      };
    });

    fileItems.push({
      label: nls.localize('force_apex_test_run_all_local_test_label'),
      description: nls.localize(
        'force_apex_test_run_all_local_tests_description_text'
      ),
      type: TestType.AllLocal
    });

    fileItems.push({
      label: nls.localize('force_apex_test_run_all_test_label'),
      description: nls.localize(
        'force_apex_test_run_all_tests_description_text'
      ),
      type: TestType.All
    });

    const apexClasses = await vscode.workspace.findFiles('**/*.cls');
    apexClasses.forEach(apexClass => {
      const fileContent = fs.readFileSync(apexClass.fsPath).toString();
      if (fileContent && fileContent.toLowerCase().includes('@istest')) {
        fileItems.push({
          label: path.basename(apexClass.toString()).replace('.cls', ''),
          description: apexClass.fsPath,
          type: TestType.Class
        });
      }
    });

    const selection = (await vscode.window.showQuickPick(
      fileItems
    )) as ApexTestQuickPickItem;
    return selection
      ? { type: 'CONTINUE', data: selection }
      : { type: 'CANCEL' };
  }
}

function getTempFolder(): string {
  if (workspaceUtils.hasRootWorkspace()) {
    const apexDir = getTestResultsFolder(workspaceUtils.getRootWorkspacePath(), 'apex');
    return apexDir;
  } else {
    throw new Error(nls.localize('cannot_determine_workspace'));
  }
}

export class ApexLibraryTestRunExecutor extends LibraryCommandletExecutor<
  ApexTestQuickPickItem
> {
  protected cancellable: boolean = true;
  public static diagnostics = vscode.languages.createDiagnosticCollection(
    'apex-errors'
  );

  constructor() {
    super(
      nls.localize('force_apex_test_run_text'),
      'force_apex_test_run_library',
      OUTPUT_CHANNEL
    );
  }

  public async run(
    response: ContinueResponse<ApexTestQuickPickItem>,
    progress?: vscode.Progress<{
      message?: string | undefined;
      increment?: number | undefined;
    }>,
    token?: vscode.CancellationToken
  ): Promise<boolean> {
    const connection = await workspaceContext.getConnection();
    const testService = new TestService(connection);
    const testLevel = TestLevel.RunSpecifiedTests;
    const codeCoverage = settings.retrieveTestCodeCoverage();

    let payload: AsyncTestConfiguration;

    switch (response.data.type) {
      case TestType.Class:
        payload = await testService.buildAsyncPayload(
          testLevel,
          undefined,
          response.data.label
        );
        break;
      case TestType.Suite:
        payload = await testService.buildAsyncPayload(
          testLevel,
          undefined,
          undefined,
          response.data.label
        );
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
        if (
          value.type === 'StreamingClientProgress' ||
          value.type === 'FormatTestResultProgress'
        ) {
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

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new TestsSelector();

export async function forceApexTestRun() {
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    new ApexLibraryTestRunExecutor()
  );
  await commandlet.run();
}
