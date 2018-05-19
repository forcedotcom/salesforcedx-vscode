/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { nls } from '../messages';

import { CommandExecution } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';

export const DEFAULT_SFDX_CHANNEL = vscode.window.createOutputChannel(
  nls.localize('channel_name')
);

export class ChannelService {
  private readonly channel: vscode.OutputChannel;
  private static instance: ChannelService;

  public constructor(channel?: vscode.OutputChannel) {
    this.channel = channel || DEFAULT_SFDX_CHANNEL;
  }

  public static getInstance(channel?: vscode.OutputChannel) {
    if (!ChannelService.instance) {
      ChannelService.instance = new ChannelService(channel);
    }
    return ChannelService.instance;
  }

  public streamCommandOutput(execution: CommandExecution) {
    this.streamCommandStartStop(execution);
    execution.stderrSubject.subscribe(data =>
      this.channel.append(data.toString())
    );
    execution.stdoutSubject.subscribe(data =>
      this.channel.append(data.toString())
    );
  }

  public streamCommandStartStop(execution: CommandExecution) {
    this.channel.append(nls.localize('channel_starting_message'));
    this.channel.appendLine(execution.command.toString());
    this.channel.appendLine('');

    this.channel.appendLine(execution.command.toCommand());

    execution.processExitSubject.subscribe(data => {
      this.channel.append(execution.command.toCommand());
      this.channel.append(' ');
      if (data !== undefined) {
        this.channel.appendLine(
          nls.localize('channel_end_with_exit_code', data.toString())
        );
      } else {
        this.channel.appendLine(nls.localize('channel_end'));
      }
      this.channel.appendLine('');
    });

    execution.processErrorSubject.subscribe(data => {
      this.channel.append(execution.command.toCommand());
      this.channel.append(' ');
      if (data !== undefined) {
        this.channel.appendLine(
          nls.localize('channel_end_with_error', data.message)
        );

        if (/sfdx.*ENOENT/.test(data.message)) {
          this.channel.appendLine(
            nls.localize('channel_end_with_sfdx_not_found')
          );
        }
      } else {
        this.channel.appendLine(nls.localize('channel_end'));
      }
      this.channel.appendLine('');
    });
  }

  public showChannelOutput() {
    this.channel.show();
  }

  public appendLine(text: string) {
    this.channel.appendLine(text);
  }
}
