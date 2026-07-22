/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ChannelService } from '@salesforce/salesforcedx-utils-vscode';
import type * as vscode from 'vscode';

// Legacy wrapper over the ONE OutputChannel the Effect layer owns (wired at activation via setCoreChannel).
// Avoids a second same-named channel — VS Code doesn't dedupe by name.

let channelServiceRef: ChannelService | undefined;

/** Wire the legacy ChannelService wrapper to the Effect layer's OutputChannel. Call once at activation. */
export const setCoreChannel = (channel: vscode.OutputChannel): void => {
  channelServiceRef = new ChannelService(channel);
};

/** Legacy channel wrapper (appendLine/showChannelOutput/...). Throws if accessed before activation wires it. */
export const getCoreChannelService = (): ChannelService => {
  if (!channelServiceRef) {
    throw new Error('Core output channel accessed before activation (setCoreChannel not called)');
  }
  return channelServiceRef;
};
