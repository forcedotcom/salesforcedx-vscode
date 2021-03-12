import { TestService } from '@salesforce/apex-node';
import {
  CancelResponse,
  ContinueResponse,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import {
  LibraryCommandletExecutor,
  SfdxCommandlet,
  SfdxWorkspaceChecker
} from '@salesforce/salesforcedx-utils-vscode/out/src';
import { workspaceContext } from '../context';
import {
  ApexLibraryTestRunExecutor,
  ApexTestQuickPickItem,
  TestType
} from './forceApexTestRun';
import * as vscode from 'vscode';
import { OUTPUT_CHANNEL } from '../channels';
import { readFileSync } from 'fs';
import { basename } from 'path';

type ApexTestSuiteOptions = { suitename: string; tests: string[] };

async function listApexClassItems(): Promise<ApexTestQuickPickItem[]> {
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
}

async function listApexTestSuiteItems(): Promise<ApexTestQuickPickItem[]> {
  const connection = await workspaceContext.getConnection();
  const testService = new TestService(connection);
  const testSuites = await testService.retrieveAllSuites();

  const quickPickItems = testSuites.map(testSuite => {
    return {
      label: testSuite.TestSuiteName,
      // @ts-ignore
      description: testSuite.Id,
      type: TestType.Suite
    };
  });
  return quickPickItems;
}

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
      'SFDX: Build Apex Test Suite',
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

export async function forceApexTestSuiteAdd() {
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    testSuiteBuilder,
    new ApexLibraryTestSuiteBuilder()
  );
  await commandlet.run();
}

export async function forceApexTestSuiteCreate() {
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    testSuiteCreator,
    new ApexLibraryTestSuiteBuilder()
  );
  await commandlet.run();
}

export async function forceApexTestSuiteRun() {
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    testSuiteSelector,
    new ApexLibraryTestRunExecutor()
  );
  await commandlet.run();
}
