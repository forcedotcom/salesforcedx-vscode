/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { TestService } from '@salesforce/apex-node';
import { sfProjectPreconditionChecker } from '@salesforce/effect-ext-utils';
import { isNotUndefined } from 'effect/Predicate';
import * as vscode from 'vscode';
import { OUTPUT_CHANNEL } from '../channels';
import { getConnection } from '../coreExtensionUtils';
import { nls } from '../messages';
import { MessageKey } from '../messages/i18n';
import {
  CancelResponse,
  ContinueResponse,
  LibraryCommandletExecutor,
  ParametersGatherer,
  SfCommandlet
} from '../utils/commandletHelpers';
import { ApexTestQuickPickItem, getTestInfo } from '../utils/fileHelpers';
import { findLocalApexClassAndTestSuiteUris } from '../utils/testUtils';
import { getTestController } from '../views/testController';
import { ApexLibraryTestRunExecutor } from './apexTestRun';

type ApexTestSuiteOptions = { suitename: string; tests: string[] };

const listApexClassItems = async (): Promise<ApexTestQuickPickItem[]> => {
  const { apexClassUris } = await findLocalApexClassAndTestSuiteUris();
  if (apexClassUris.length === 0) {
    return [];
  }
  const items = await Promise.all(
    apexClassUris.map(
      (uri): Promise<ApexTestQuickPickItem | undefined> => getTestInfo(uri).catch((): undefined => undefined)
    )
  );
  return items.filter(isNotUndefined).toSorted((a, b): number => a.label.localeCompare(b.label));
};

const listApexTestSuiteItems = async (): Promise<ApexTestQuickPickItem[]> => {
  const connection = await getConnection();
  const testService = new TestService(connection);
  return (await testService.retrieveAllSuites()).map(testSuite => ({
    label: testSuite.TestSuiteName,
    description: testSuite.id,
    type: 'Suite'
  }));
};

class TestSuiteSelector implements ParametersGatherer<ApexTestQuickPickItem> {
  public async gather(): Promise<CancelResponse | ContinueResponse<ApexTestQuickPickItem>> {
    const quickPickItems = await listApexTestSuiteItems();

    const testSuiteName = await vscode.window.showQuickPick<ApexTestQuickPickItem>(quickPickItems);

    return testSuiteName ? { type: 'CONTINUE', data: testSuiteName } : { type: 'CANCEL' };
  }
}

class TestSuiteBuilder implements ParametersGatherer<ApexTestSuiteOptions> {
  public async gather(): Promise<CancelResponse | ContinueResponse<ApexTestSuiteOptions>> {
    const quickPickItems = await listApexTestSuiteItems();

    const testSuiteName = await vscode.window.showQuickPick<ApexTestQuickPickItem>(quickPickItems);

    if (testSuiteName) {
      const apexClassItems = await listApexClassItems();

      const apexClassSelection = await vscode.window.showQuickPick<ApexTestQuickPickItem>(apexClassItems, {
        canPickMany: true
      });
      if (!apexClassSelection || apexClassSelection.length === 0) {
        return { type: 'CANCEL' };
      }
      const apexClassNames = apexClassSelection.map(selection => selection.label);
      return {
        type: 'CONTINUE',
        data: { suitename: testSuiteName.label, tests: apexClassNames }
      };
    }
    return { type: 'CANCEL' };
  }
}

class TestSuiteCreator implements ParametersGatherer<ApexTestSuiteOptions> {
  public async gather(): Promise<CancelResponse | ContinueResponse<ApexTestSuiteOptions>> {
    const testSuiteInput: vscode.InputBoxOptions = {
      prompt: 'Enter desired Apex test suite name:'
    };
    const testSuiteName = await vscode.window.showInputBox(testSuiteInput);

    if (testSuiteName) {
      let apexClassItems: ApexTestQuickPickItem[];
      try {
        apexClassItems = await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: nls.localize('retrieving_tests_message'),
            cancellable: true
          },
          async (_progress, token) => {
            const items = await listApexClassItems();
            if (token.isCancellationRequested) {
              throw new vscode.CancellationError();
            }
            return items;
          }
        );
      } catch (e) {
        if (e instanceof vscode.CancellationError) {
          return { type: 'CANCEL' };
        }
        throw e;
      }

      const apexClassSelection = await vscode.window.showQuickPick<ApexTestQuickPickItem>(apexClassItems, {
        canPickMany: true
      });
      if (!apexClassSelection || apexClassSelection.length === 0) {
        return { type: 'CANCEL' };
      }
      const apexClassNames = apexClassSelection.map(selection => selection.label);
      return {
        type: 'CONTINUE',
        data: { suitename: testSuiteName, tests: apexClassNames }
      };
    }
    return { type: 'CANCEL' };
  }
}

class ApexLibraryTestSuiteBuilder extends LibraryCommandletExecutor<ApexTestSuiteOptions> {
  public static diagnostics = vscode.languages.createDiagnosticCollection('apex-testing-errors');

  constructor(notificationMessageKey: MessageKey) {
    super(nls.localize(notificationMessageKey), 'apex_test_suite_build_library', OUTPUT_CHANNEL);
  }

  public async run(response: ContinueResponse<ApexTestSuiteOptions>): Promise<boolean> {
    const connection = await getConnection();
    const testService = new TestService(connection);
    await testService.buildSuite(response.data.suitename, response.data.tests);
    return true;
  }
}

export const apexTestSuiteAdd = async () => {
  const commandlet = new SfCommandlet(
    sfProjectPreconditionChecker,
    new TestSuiteBuilder(),
    new ApexLibraryTestSuiteBuilder('apex_test_suite_add_text')
  );
  const didRun = await commandlet.run();
  if (didRun) {
    // Clear all suite children so they re-query from org instead of using stale local files
    const testController = getTestController();
    testController.clearAllSuiteChildren();
    // Refresh to update the tree with latest suite data from org
    void testController.refresh();
  }
};

export const apexTestSuiteCreate = async () => {
  const commandlet = new SfCommandlet(
    sfProjectPreconditionChecker,
    new TestSuiteCreator(),
    new ApexLibraryTestSuiteBuilder('apex_test_suite_create_text')
  );
  const didRun = await commandlet.run();
  if (didRun) {
    // Clear all suite children so they re-query from org instead of using stale local files
    const testController = getTestController();
    testController.clearAllSuiteChildren();
    // Refresh to update the tree with the newly created suite
    void testController.refresh();
  }
};

export const apexTestSuiteRun = async () => {
  const commandlet = new SfCommandlet(
    sfProjectPreconditionChecker,
    new TestSuiteSelector(),
    new ApexLibraryTestRunExecutor()
  );
  await commandlet.run();
};
