/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { TestService } from '@salesforce/apex-node-bundle';
import {
  CancelResponse,
  ContinueResponse,
  LibraryCommandletExecutor,
  ParametersGatherer,
  SFDX_FOLDER,
  SfCommandlet,
  SfWorkspaceChecker
} from '@salesforce/salesforcedx-utils-vscode';
import { readFileSync } from 'fs';
import { basename } from 'path';
import * as vscode from 'vscode';
import { OUTPUT_CHANNEL } from '../channels';
import { APEX_CLASS_EXT, IS_TEST_REG_EXP } from '../constants';
import { workspaceContext } from '../context';
import { nls } from '../messages';
import { ApexLibraryTestRunExecutor, ApexTestQuickPickItem, TestType } from './apexTestRun';

export type ApexTestSuiteOptions = { suitename: string; tests: string[] };

const listApexClassItems = async (): Promise<ApexTestQuickPickItem[]> => {
  const apexClasses = await vscode.workspace.findFiles(`**/*${APEX_CLASS_EXT}`, SFDX_FOLDER);
  const apexClassItems = apexClasses
    .filter(apexClass => {
      const fileContent = readFileSync(apexClass.fsPath).toString();
      return IS_TEST_REG_EXP.test(fileContent);
    })
    .map(apexClass => {
      return {
        label: basename(apexClass.toString(), APEX_CLASS_EXT),
        description: apexClass.fsPath,
        type: TestType.Class
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  return apexClassItems;
};

const listApexTestSuiteItems = async (): Promise<ApexTestQuickPickItem[]> => {
  const connection = await workspaceContext.getConnection();
  const testService = new TestService(connection);
  const testSuites = await testService.retrieveAllSuites();

  const quickPickItems = testSuites.map(testSuite => {
    return {
      label: testSuite.TestSuiteName,
      description: testSuite.id,
      type: TestType.Suite
    };
  });
  return quickPickItems;
};

export class TestSuiteSelector implements ParametersGatherer<ApexTestQuickPickItem> {
  public async gather(): Promise<CancelResponse | ContinueResponse<ApexTestQuickPickItem>> {
    const quickPickItems = await listApexTestSuiteItems();

    const testSuiteName = (await vscode.window.showQuickPick(quickPickItems)) as ApexTestQuickPickItem;

    return testSuiteName ? { type: 'CONTINUE', data: testSuiteName } : { type: 'CANCEL' };
  }
}

export class TestSuiteBuilder implements ParametersGatherer<ApexTestSuiteOptions> {
  public async gather(): Promise<CancelResponse | ContinueResponse<ApexTestSuiteOptions>> {
    const quickPickItems = await listApexTestSuiteItems();

    const testSuiteName = (await vscode.window.showQuickPick(quickPickItems)) as ApexTestQuickPickItem;

    if (testSuiteName) {
      const apexClassItems = await listApexClassItems();

      const apexClassSelection = (await vscode.window.showQuickPick(apexClassItems, {
        canPickMany: true
      })) as ApexTestQuickPickItem[];
      const apexClassNames = apexClassSelection?.map(selection => selection.label);

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

export class TestSuiteCreator implements ParametersGatherer<ApexTestSuiteOptions> {
  public async gather(): Promise<CancelResponse | ContinueResponse<ApexTestSuiteOptions>> {
    const testSuiteInput = {
      prompt: 'Enter desired Apex test suite name:'
    } as vscode.InputBoxOptions;
    const testSuiteName = await vscode.window.showInputBox(testSuiteInput);

    if (testSuiteName) {
      const apexClassItems = await listApexClassItems();

      const apexClassSelection = (await vscode.window.showQuickPick(apexClassItems, {
        canPickMany: true
      })) as ApexTestQuickPickItem[];
      const apexClassNames = apexClassSelection?.map(selection => selection.label);

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

export class ApexLibraryTestSuiteBuilder extends LibraryCommandletExecutor<ApexTestSuiteOptions> {
  public static diagnostics = vscode.languages.createDiagnosticCollection('apex-errors');

  constructor() {
    super(nls.localize('apex_test_suite_build_text'), 'apex_test_suite_build_library', OUTPUT_CHANNEL);
  }

  public async run(response: ContinueResponse<ApexTestSuiteOptions>): Promise<boolean> {
    const connection = await workspaceContext.getConnection();
    const testService = new TestService(connection);
    await testService.buildSuite(response.data.suitename, response.data.tests);
    return true;
  }
}

const workspaceChecker = new SfWorkspaceChecker();
const testSuiteSelector = new TestSuiteSelector();
const testSuiteCreator = new TestSuiteCreator();
const testSuiteBuilder = new TestSuiteBuilder();

export const apexTestSuiteAdd = async () => {
  const commandlet = new SfCommandlet(workspaceChecker, testSuiteBuilder, new ApexLibraryTestSuiteBuilder());
  await commandlet.run();
};

export const apexTestSuiteCreate = async () => {
  const commandlet = new SfCommandlet(workspaceChecker, testSuiteCreator, new ApexLibraryTestSuiteBuilder());
  await commandlet.run();
};

export const apexTestSuiteRun = async () => {
  const commandlet = new SfCommandlet(workspaceChecker, testSuiteSelector, new ApexLibraryTestRunExecutor());
  await commandlet.run();
};
