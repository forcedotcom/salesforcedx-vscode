/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { OutputChannel, window } from 'vscode';

export class ChannelService {
  private readonly channel: OutputChannel;
  private static instances: { [key: string]: ChannelService } = {};

  constructor(channel: OutputChannel) {
    this.channel = channel;
  }

  public static getInstance(channelName: string) {
    if (!ChannelService.instances[channelName]) {
      const outputChannel = window.createOutputChannel(channelName);
      ChannelService.instances[channelName] = new ChannelService(outputChannel);
    }
    return ChannelService.instances[channelName];
  }

  public showChannelOutput() {
    this.channel.show(true);
  }

  public appendLine(text: string) {
    this.channel.appendLine(text);
  }
}
