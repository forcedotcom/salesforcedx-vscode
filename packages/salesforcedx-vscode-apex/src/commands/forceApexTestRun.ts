/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  AsyncTestConfiguration,
  HumanReporter,
  ResultFormat,
  TestLevel,
  TestService
} from '@salesforce/apex-node';
import {
  getRootWorkspacePath,
  hasRootWorkspace,
  LibraryCommandletExecutor,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from '@salesforce/salesforcedx-utils-vscode/out/src';
import {
  Command,
  SfdxCommandBuilder,
  TestRunner
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  CancelResponse,
  ContinueResponse,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { channelService, OUTPUT_CHANNEL } from '../channels';
import { workspaceContext } from '../context';
import { nls } from '../messages';
import * as settings from '../settings';

export enum TestType {
  All,
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

export class ForceApexTestRunCommandFactory {
  private data: ApexTestQuickPickItem;
  private getCodeCoverage: boolean;
  private builder: SfdxCommandBuilder = new SfdxCommandBuilder();
  private testRunExecutorCommand!: Command;
  private outputToJson: string;

  constructor(
    data: ApexTestQuickPickItem,
    getCodeCoverage: boolean,
    outputToJson: string
  ) {
    this.data = data;
    this.getCodeCoverage = getCodeCoverage;
    this.outputToJson = outputToJson;
  }

  public constructExecutorCommand(): Command {
    this.builder = this.builder
      .withDescription(nls.localize('force_apex_test_run_text'))
      .withArg('force:apex:test:run')
      .withLogName('force_apex_test_run');

    switch (this.data.type) {
      case TestType.Suite:
        this.builder = this.builder.withFlag(
          '--suitenames',
          `${this.data.label}`
        );
        break;
      case TestType.Class:
        this.builder = this.builder.withFlag(
          '--classnames',
          `${this.data.label}`
        );
        break;
      default:
        break;
    }

    if (this.getCodeCoverage) {
      this.builder = this.builder.withArg('--codecoverage');
    }

    this.builder = this.builder
      .withFlag('--resultformat', 'human')
      .withFlag('--outputdir', this.outputToJson)
      .withFlag('--loglevel', 'error');

    this.testRunExecutorCommand = this.builder.build();
    return this.testRunExecutorCommand;
  }
}

function getTempFolder(): string {
  if (hasRootWorkspace()) {
    const apexDir = new TestRunner().getTempFolder(
      getRootWorkspacePath(),
      'apex'
    );
    return apexDir;
  } else {
    throw new Error(nls.localize('cannot_determine_workspace'));
  }
}

export class ForceApexTestRunExecutor extends SfdxCommandletExecutor<
  ApexTestQuickPickItem
> {
  constructor() {
    super(OUTPUT_CHANNEL);
  }

  public build(data: ApexTestQuickPickItem): Command {
    const getCodeCoverage = settings.retrieveTestCodeCoverage();
    const outputToJson = getTempFolder();
    const factory: ForceApexTestRunCommandFactory = new ForceApexTestRunCommandFactory(
      data,
      getCodeCoverage,
      outputToJson
    );
    return factory.constructExecutorCommand();
  }
}

export class ApexLibraryTestRunExecutor extends LibraryCommandletExecutor<
  ApexTestQuickPickItem
> {
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
    response: ContinueResponse<ApexTestQuickPickItem>
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
      default:
        payload = { testLevel: TestLevel.RunAllTestsInOrg };
    }

    const result = await testService.runTestAsynchronous(payload, codeCoverage);
    await testService.writeResultFiles(
      result,
      { resultFormats: [ResultFormat.json], dirPath: getTempFolder() },
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
    settings.useApexLibrary()
      ? new ApexLibraryTestRunExecutor()
      : new ForceApexTestRunExecutor()
  );
  await commandlet.run();
}
