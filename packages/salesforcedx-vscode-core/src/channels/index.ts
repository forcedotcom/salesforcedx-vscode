import * as vscode from 'vscode';
import { get } from '../messages';

import { CommandExecution } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';

export const DEFAULT_SFDX_CHANNEL = vscode.window.createOutputChannel(
  get('channel_name')
);

export function streamCommandOutput(execution: CommandExecution) {
  DEFAULT_SFDX_CHANNEL.append(get('channel_starting_message'));
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
    if (data) {
      DEFAULT_SFDX_CHANNEL.appendLine(
        get('channel_end_with_exit_code', data.toString())
      );
    } else {
      DEFAULT_SFDX_CHANNEL.appendLine(get('channel_end'));
    }
  });
}
