import * as vscode from 'vscode';

import { CommandExecution } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';

export const DEFAULT_SFDX_CHANNEL = vscode.window.createOutputChannel(
  'SalesforceDX - CLI'
);

export function streamCommandOutput(execution: CommandExecution) {
  DEFAULT_SFDX_CHANNEL.append('Starting ');
  DEFAULT_SFDX_CHANNEL.appendLine(execution.command.toString());
  DEFAULT_SFDX_CHANNEL.appendLine('');

  execution.stderrSubject.subscribe(data =>
    DEFAULT_SFDX_CHANNEL.append(data.toString())
  );
  execution.stdoutSubject.subscribe(data =>
    DEFAULT_SFDX_CHANNEL.append(data.toString())
  );

  execution.processExitSubject.subscribe(data => {
    DEFAULT_SFDX_CHANNEL.append(execution.command.toString());
    DEFAULT_SFDX_CHANNEL.appendLine(
      'ended' + data == null ? ` with exit code ${data.toString()}` : ''
    );
  });
}
