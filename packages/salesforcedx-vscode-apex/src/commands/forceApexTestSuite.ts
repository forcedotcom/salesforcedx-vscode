/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { TestService } from '@salesforce/apex-node';
import {
  LibraryCommandletExecutor,
  SfdxCommandlet,
  SfdxWorkspaceChecker
} from '@salesforce/salesforcedx-utils-vscode';
import {
  CancelResponse,
  ContinueResponse,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode';
import { readFileSync } from 'fs';
import { basename } from 'path';
import * as vscode from 'vscode';
import { OUTPUT_CHANNEL } from '../channels';
import { workspaceContext } from '../context';
import { nls } from '../messages';
import {
  ApexLibraryTestRunExecutor,
  ApexTestQuickPickItem,
  TestType
} from './forceApexTestRun';

export type ApexTestSuiteOptions = { suitename: string; tests: string[] };

const listApexClassItems = async (): Promise<ApexTestQuickPickItem[]> => {
  const apexClasses = await vscode.workspace.findFiles('**/*.cls');
  const apexClassItems: ApexTestQuickPickItem[] = [];

  apexClasses.forEach(apexClass => {
    const fileContent = readFileSync(apexClass.fsPath).toString();
    if (fileContent && fileContent.toLowerCase().includes('@istest')) {
      apexClassItems.push({
        label: basename(apexClass.toString()).replace('.cls', ''),
        description: apexClass.fsPath,
        type: TestType.Class
      });
    }
  });

  return apexClassItems;
};

const listApexTestSuiteItems = async (): Promise<ApexTestQuickPickItem[]> => {
  const connection = await workspaceContext.getConnection();
  const testService = new TestService(connection);
  const testSuites = await testService.retrieveAllSuites();

  const quickPickItems = testSuites.map(testSuite => {
    return {
      label: testSuite.TestSuiteName,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      description: testSuite.Id,
      type: TestType.Suite
    };
  });
  return quickPickItems;
};

export class TestSuiteSelector
  implements ParametersGatherer<ApexTestQuickPickItem> {
  public async gather(): Promise<
    CancelResponse | ContinueResponse<ApexTestQuickPickItem>
  > {
    const quickPickItems = await listApexTestSuiteItems();

    const testSuiteName = (await vscode.window.showQuickPick(
      quickPickItems
    )) as ApexTestQuickPickItem;

    return testSuiteName
      ? { type: 'CONTINUE', data: testSuiteName }
      : { type: 'CANCEL' };
  }
}

export class TestSuiteBuilder
  implements ParametersGatherer<ApexTestSuiteOptions> {
  public async gather(): Promise<
    CancelResponse | ContinueResponse<ApexTestSuiteOptions>
  > {
    const quickPickItems = await listApexTestSuiteItems();

    const testSuiteName = (await vscode.window.showQuickPick(
      quickPickItems
    )) as ApexTestQuickPickItem;

    if (testSuiteName) {
      const apexClassItems = await listApexClassItems();

      const apexClassSelection = (await vscode.window.showQuickPick(
        apexClassItems,
        { canPickMany: true }
      )) as ApexTestQuickPickItem[];
      const apexClassNames = apexClassSelection?.map(
        selection => selection.label
      );

      return apexClassSelection
        ? {
            type: 'CONTINUE',
            data: { suitename: testSuiteName.label, tests: apexClassNames }
          }
        : { type: 'CANCEL' };
    }
    return { type: 'CANCEL' };
  }
}

export class TestSuiteCreator
  implements ParametersGatherer<ApexTestSuiteOptions> {
  public async gather(): Promise<
    CancelResponse | ContinueResponse<ApexTestSuiteOptions>
  > {
    const testSuiteInput = {
      prompt: 'Enter desired Apex test suite name:'
    } as vscode.InputBoxOptions;
    const testSuiteName = await vscode.window.showInputBox(testSuiteInput);

    if (testSuiteName) {
      const apexClassItems = await listApexClassItems();

      const apexClassSelection = (await vscode.window.showQuickPick(
        apexClassItems,
        { canPickMany: true }
      )) as ApexTestQuickPickItem[];
      const apexClassNames = apexClassSelection?.map(
        selection => selection.label
      );

      return apexClassSelection
        ? {
            type: 'CONTINUE',
            data: { suitename: testSuiteName, tests: apexClassNames }
          }
        : { type: 'CANCEL' };
    }
    return { type: 'CANCEL' };
  }
}

export class ApexLibraryTestSuiteBuilder extends LibraryCommandletExecutor<
  ApexTestSuiteOptions
> {
  public static diagnostics = vscode.languages.createDiagnosticCollection(
    'apex-errors'
  );

  constructor() {
    super(
      nls.localize('force_apex_test_suite_build_text'),
      'force_apex_test_suite_build_library',
      OUTPUT_CHANNEL
    );
  }

  public async run(
    response: ContinueResponse<ApexTestSuiteOptions>
  ): Promise<boolean> {
    const connection = await workspaceContext.getConnection();
    const testService = new TestService(connection);
    await testService.buildSuite(response.data.suitename, response.data.tests);
    return true;
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();
const testSuiteSelector = new TestSuiteSelector();
const testSuiteCreator = new TestSuiteCreator();
const testSuiteBuilder = new TestSuiteBuilder();

export const forceApexTestSuiteAdd = async () => {
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    testSuiteBuilder,
    new ApexLibraryTestSuiteBuilder()
  );
  await commandlet.run();
};

export const forceApexTestSuiteCreate = async () => {
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    testSuiteCreator,
    new ApexLibraryTestSuiteBuilder()
  );
  await commandlet.run();
};

export const forceApexTestSuiteRun = async () => {
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    testSuiteSelector,
    new ApexLibraryTestRunExecutor()
  );
  await commandlet.run();
};
