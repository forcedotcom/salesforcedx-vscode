import * as vscode from 'vscode';
import fs = require('fs');
import ospath = require('path');
import {
  CliCommandExecutor,
  Command,
  CommandExecution
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { CommandOutput } from '@salesforce/salesforcedx-utils-vscode/out/src/cli/commandOutput';
import {
  CancelResponse,
  ContinueResponse,
  DirFileNameSelection,
  ParametersGatherer,
  PostconditionChecker,
  PreconditionChecker
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { SfdxCommandlet, SfdxWorkspaceChecker } from '../commands';
import { EmptyParametersGatherer } from '../commands/commands';
import { ForceApexTestRunCodeActionExecutor } from '../commands/forceApexTestRunCodeAction';
import { nls } from '../messages';

// import { File, TestsSelector } from '../commands/forceApexTestRun';

export class ApexTestOutlineProvider implements vscode.TreeDataProvider<ApexTest> {
  private head: ApexTest | null;
  private static testStrings: string[] = new Array<string>();

  constructor(private path: string, private apexClasses: vscode.Uri[]) {
    this.head = null;
    this.getAllApexTests(this.path);
  }

  public getChildren(element: ApexTest): Thenable<ApexTest[]> {
    if (element) {
      return Promise.resolve(element.children);
    } else {
      if (this.head && this.head.children.length > 0) {
        return Promise.resolve(this.head.children);
      } else {
        const emptyArray = new Array<ApexTest>();
        emptyArray.push(new ApexTest('No tests in folder'));
        return Promise.resolve(emptyArray);
      }
    }
  }

  public getTreeItem(element: ApexTest): vscode.TreeItem {
    if (element) {
      return element;
    } else {
      this.getAllApexTests(this.path);
      if (this.head && this.head.children.length > 0) {
        return this.head;
      } else {
        return new ApexTest('No tests in folder');
      }
    }
  }

  private getAllApexTests(path: string): void {
    if (this.head == null) {
      this.head = new ApexTestGroup('ApexTests');
    }
    this.apexClasses.forEach(apexClass => {
      const fileContent = fs.readFileSync(apexClass.fsPath).toString();
      if (fileContent && fileContent.toLowerCase().includes('@istest')) {
        const testName = ospath.basename(apexClass.toString()).replace('.cls', '');
        const newApexTestGroup = new ApexTestGroup(testName);
        this.addTests(fileContent.toLowerCase(), newApexTestGroup);
        ApexTestOutlineProvider.testStrings.push(testName);
        if (this.head) {
          this.head.children.push(newApexTestGroup);
        }
      }
    });
  }

  private addTests(fileContent: string, apexTestGroup: ApexTestGroup): void {
    // Parse through file and find apex tests
    const testTexts = fileContent.split('@istest');
    // 0 is stuff before @istest and 1 contains class description
    for (let i = 2; i < testTexts.length; i++) {
      const testText = testTexts[i];
      const headerBody = testText.split('{');
      const header = headerBody[0];
      const headerParts = header.split(' ');

      // Name is last part of the header
      let name = '';
      while (name === '') {
        const headerPart = headerParts.pop();
        if (headerPart) {
          name = headerPart;
        }
      }
      name = name.replace('()', '');
      const apexTest = new ApexTest(name);
      // ApexTestOutlineProvider.testStrings.push(apexTestGroup.label + '.' + name);
      apexTestGroup.children.push(apexTest);
    }
  }

  public runApexTests() {
    ApexTestOutlineProvider.testStrings.forEach(async testClass => {
      const builder = new ReadableApexTestRunCodeActionExecutor(testClass, true, true);
      const commandlet = new SfdxCommandlet(
        new SfdxWorkspaceChecker(),
        new EmptyParametersGatherer(),
        builder);
      await commandlet.run();
    });
  }
}

export abstract class Test extends vscode.TreeItem {
  public children = new Array<Test>();

  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
  }

  public abstract iconPath = {
    light: 'path to light icon',
    dark: 'path to dark icon'
  };

  get tooltip(): string {
    return this.label;
  }

  public abstract contextValue: string;
}

export class ApexTestGroup extends Test {

  constructor(
    public readonly label: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.Expanded);
  }

  public contextValue = 'apex test group';

  public iconPath = {
    light: ospath.join(__filename, '..', '..', '..', '..', '..', '..', 'resources', 'BlueButton.svg'),
    dark: ospath.join(__filename, '..', '..', '..', '..', '..', '..', 'resources', 'BlueButton.svg')
  };
}

export class ApexTest extends Test {
  constructor(
    public readonly label: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
  }

  public iconPath = {
    light: ospath.join(__filename, '..', '..', '..', '..', '..', '..', 'resources', 'BlueButton.svg'),
    dark: ospath.join(__filename, '..', '..', '..', '..', '..', '..', 'resources', 'BlueButton.svg')
  };

  public contextValue = 'apex test';

}

export class ReadableApexTestRunCodeActionExecutor extends ForceApexTestRunCodeActionExecutor {
  private outputToJson: boolean;

  public constructor(test: string, shouldGetCodeCoverage: boolean, outputToJson: boolean) {
    super(test, shouldGetCodeCoverage);
    this.outputToJson = outputToJson;
  }

  public build(data: {}): Command {
    this.builder = this.builder
      .withDescription(
        nls.localize('force_apex_test_run_codeAction_description_text')
      )
      .withArg('force:apex:test:run')
      .withFlag('--tests', this.test)
      .withFlag('--resultformat', 'human')
      .withArg('--synchronous');

    if (this.shouldGetCodeCoverage) {
      this.builder = this.builder.withArg('--codecoverage');
    }

    if (this.outputToJson) {
      this.builder = this.builder.withArg('--json');
    } else {
      this.builder = this.builder.withFlag('--loglevel', 'error');
    }
    return this.builder.build();
  }

  public async execute(response: ContinueResponse<{}>): Promise<void> {
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;
    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: vscode.workspace.rootPath
    }).execute(cancellationToken);

    const cmdOutput = new CommandOutput();
    const result = await cmdOutput.getCmdResult(execution);
    console.log(result);

    this.attachExecution(execution, cancellationTokenSource, cancellationToken);
  }

}
