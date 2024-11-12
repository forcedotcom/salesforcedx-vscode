/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { OutputChannel, window } from 'vscode';
import { CommandExecution } from '../cli';
import { stripAnsi } from '../helpers/utils';
import { nls } from '../messages';
import { SettingsService } from '../settings';

export class ChannelService {
  private readonly channel: OutputChannel;
  private static instances: { [key: string]: ChannelService } = {};

  public constructor(channel: OutputChannel) {
    this.channel = channel;
  }

  public static getInstance(channelName: string) {
    if (!ChannelService.instances[channelName]) {
      const outputChannel = window.createOutputChannel(channelName);
      ChannelService.instances[channelName] = new ChannelService(outputChannel);
    }
    return ChannelService.instances[channelName];
  }

  public streamCommandOutput(execution: CommandExecution) {
    this.streamCommandStartStop(execution);
    execution.stderrSubject.subscribe(data => this.channel.append(stripAnsi(data.toString())));
    execution.stdoutSubject.subscribe(data => this.channel.append(stripAnsi(data.toString())));
  }

  public streamCommandStartStop(execution: CommandExecution) {
    if (SettingsService.getEnableClearOutputBeforeEachCommand()) {
      this.clear();
    }
    this.channel.append(nls.localize('channel_starting_message'));
    this.channel.appendLine(execution.command.toString());
    this.channel.appendLine('');

    this.showCommandWithTimestamp(execution.command.toCommand());

    execution.processExitSubject.subscribe(data => {
      this.showCommandWithTimestamp(execution.command.toCommand());
      this.channel.append(' ');
      if (data !== undefined && data !== null) {
        this.channel.appendLine(nls.localize('channel_end_with_exit_code', data.toString()));
      } else {
        this.channel.appendLine(nls.localize('channel_end'));
      }
      this.channel.appendLine('');
    });

    execution.processErrorSubject.subscribe(data => {
      this.showCommandWithTimestamp(execution.command.toCommand());

      this.channel.append(' ');
      if (data !== undefined) {
        if (/sfdx.*ENOENT/.test(data.message)) {
          this.channel.appendLine(nls.localize('channel_end_with_sfdx_not_found'));
        } else {
          this.channel.appendLine(nls.localize('channel_end_with_error', data.message));
        }
      } else {
        this.channel.appendLine(nls.localize('channel_end'));
      }
      this.channel.appendLine('');
    });
  }

  public showCommandWithTimestamp(commandName: string) {
    this.channel.appendLine(this.getExecutionTime() + ' ' + commandName);
  }

  private getExecutionTime() {
    const d = new Date();
    const hr = this.ensureDoubleDigits(d.getHours());
    const mins = this.ensureDoubleDigits(d.getMinutes());
    const sec = this.ensureDoubleDigits(d.getSeconds());
    const milli = d.getMilliseconds();
    return `${hr}:${mins}:${sec}.${milli}`;
  }

  private ensureDoubleDigits(num: number) {
    return num < 10 ? `0${num.toString()}` : num.toString();
  }

  public showChannelOutput() {
    this.channel.show(true);
  }

  public appendLine(text: string) {
    this.channel.appendLine(text);
  }

  public clear() {
    this.channel.clear();
  }
}
