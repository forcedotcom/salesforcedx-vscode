import * as vscode from 'vscode';
import * as path from 'path';
import * as status from './status';
import {
  CliCommandExecutor,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';

const channel = vscode.window.createOutputChannel('SalesforceDX - CLI');

export function forceAuthWebLogin() {
  channel.appendLine('force:auth:web:login --setdefaultdevhubusername');

  status.showStatus('Authenticating');
  const execution = new CliCommandExecutor(
    new SfdxCommandBuilder()
      .withArg('force:auth:web:login')
      .withArg('--setdefaultdevhubusername')
      .build(),
    { cwd: vscode.workspace.rootPath }
  ).execute();

  execution.stderrSubject.subscribe(data => channel.append(data.toString()));
  execution.stdoutSubject.subscribe(data => channel.append(data.toString()));
  execution.processExitSubject.subscribe(data => status.hideStatus());
}

export function forceOrgCreate() {
  channel.appendLine('force:org:create');

  vscode.workspace.findFiles('config/*.json', '').then(files => {
    const fileItems: vscode.QuickPickItem[] = files.map(file => {
      return {
        label: path.basename(file.toString()),
        description: file.fsPath
      };
    });
    vscode.window.showQuickPick(fileItems).then(selection => {
      if (selection) {
        status.showStatus('Creating org');
        const rootPath = vscode.workspace.rootPath!;
        const selectionPath = path.relative(
          rootPath,
          selection.description.toString()
        );
        const execution = new CliCommandExecutor(
          new SfdxCommandBuilder()
            .withArg('force:org:create')
            .withFlag('-f', `${selectionPath}`)
            .withArg('--setdefaultusername')
            .build(),
          { cwd: vscode.workspace.rootPath }
        ).execute();

        execution.stderrSubject.subscribe(data =>
          channel.append(data.toString())
        );
        execution.stdoutSubject.subscribe(data =>
          channel.append(data.toString())
        );
        execution.processExitSubject.subscribe(data => status.hideStatus());
      }
    });
  });
}

export function forceOrgOpen() {
  channel.appendLine('force:org:open');

  status.showStatus('Opening org');
  const execution = new CliCommandExecutor(
    new SfdxCommandBuilder().withArg('force:org:open').build(),
    { cwd: vscode.workspace.rootPath }
  ).execute();

  execution.stderrSubject.subscribe(data => channel.append(data.toString()));
  execution.stdoutSubject.subscribe(data => channel.append(data.toString()));
  execution.processExitSubject.subscribe(data => status.hideStatus());
}

export function forceSourcePull() {
  channel.appendLine('force:source:pull');

  status.showStatus('Pulling from org...');
  const execution = new CliCommandExecutor(
    new SfdxCommandBuilder().withArg('force:source:pull').build(),
    { cwd: vscode.workspace.rootPath }
  ).execute();

  execution.stderrSubject.subscribe(data => channel.append(data.toString()));
  execution.stdoutSubject.subscribe(data => channel.append(data.toString()));
  execution.processExitSubject.subscribe(data => status.hideStatus());
}

export function forceSourcePush() {
  channel.appendLine('force:source:push');

  status.showStatus('Pushing to org');
  const execution = new CliCommandExecutor(
    new SfdxCommandBuilder().withArg('force:source:push').build(),
    { cwd: vscode.workspace.rootPath }
  ).execute();

  execution.stderrSubject.subscribe(data => channel.append(data.toString()));
  execution.stdoutSubject.subscribe(data => channel.append(data.toString()));
  execution.processExitSubject.subscribe(data => status.hideStatus());
}

export function forceSourceStatus() {
  channel.appendLine('force:source:status');

  status.showStatus('Checking status against org');
  const execution = new CliCommandExecutor(
    new SfdxCommandBuilder().withArg('force:source:status').build(),
    { cwd: vscode.workspace.rootPath }
  ).execute();

  execution.stderrSubject.subscribe(data => channel.append(data.toString()));
  execution.stdoutSubject.subscribe(data => channel.append(data.toString()));
  execution.processExitSubject.subscribe(data => status.hideStatus());
}

export function forceApexTestRun(testClass?: string) {
  channel.appendLine('force:apex:test:run');

  if (testClass) {
    status.showStatus('Running apex tests');
    const execution = new CliCommandExecutor(
      new SfdxCommandBuilder()
        .withArg('force:apex:test:run')
        .withFlag('--classnames', `${testClass}`)
        .withFlag('--resultformat', 'human')
        .build(),
      { cwd: vscode.workspace.rootPath }
    ).execute();

    execution.stderrSubject.subscribe(data => channel.append(data.toString()));
    execution.stdoutSubject.subscribe(data => channel.append(data.toString()));
    execution.processExitSubject.subscribe(data => status.hideStatus());
  } else {
    vscode.workspace.findFiles('**/*.testSuite-meta.xml', '').then(files => {
      const fileItems: vscode.QuickPickItem[] = files.map(file => {
        return {
          label: path
            .basename(file.toString())
            .replace('.testSuite-meta.xml', ''),
          description: file.fsPath
        };
      });

      fileItems.push({
        label: 'All tests',
        description: 'Runs all tests in the current workspace'
      });

      vscode.window.showQuickPick(fileItems).then(selection => {
        if (selection) {
          status.showStatus('Running apex tests');
          if (selection.label === 'All tests') {
            const execution = new CliCommandExecutor(
              new SfdxCommandBuilder()
                .withArg('force:apex:test:run')
                .withFlag('--resultformat', 'human')
                .build(),
              { cwd: vscode.workspace.rootPath }
            ).execute();
            execution.stderrSubject.subscribe(data =>
              channel.append(data.toString())
            );
            execution.stdoutSubject.subscribe(data =>
              channel.append(data.toString())
            );
            execution.processExitSubject.subscribe(data => status.hideStatus());
          } else {
            const execution = new CliCommandExecutor(
              new SfdxCommandBuilder()
                .withArg('force:apex:test:run')
                .withFlag('--suitenames', `${selection.label}`)
                .withFlag('--resultformat', 'human')
                .build(),
              { cwd: vscode.workspace.rootPath }
            ).execute();

            execution.stderrSubject.subscribe(data =>
              channel.append(data.toString())
            );
            execution.stdoutSubject.subscribe(data =>
              channel.append(data.toString())
            );
            execution.processExitSubject.subscribe(data => status.hideStatus());
          }
        }
      });
    });
  }
}
