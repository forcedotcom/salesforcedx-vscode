/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { getRuntime } from '../services/runtime';

export enum VSCodeWindowTypeEnum {
  Error = 1,
  Informational = 2,
  Warning = 3
}

const getChannelService = Effect.gen(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  return yield* api.services.ChannelService;
});

/**
 * Resolves the debugger output channel. Resolving is what creates it, so activation has to yield on
 * this for `Apex Replay Debugger` to be in the Output dropdown before any output is written.
 */
export const getDebuggerOutputChannel = Effect.flatMap(getChannelService, channelService => channelService.getChannel);

const appendAndShow = Effect.fn('channels.appendAndShowChannelOutput')(function* (message: string) {
  const channelService = yield* getChannelService;
  yield* channelService.appendToChannel(message);
  const channel = yield* channelService.getChannel;
  // show(true) = preserveFocus, as the legacy showChannelOutput() did: revealing the channel on every
  // debugger write must not pull keyboard focus out of the editor.
  yield* Effect.sync(() => channel.show(true));
});

/**
 * Fire-and-forget append to the services ChannelService, revealing the channel.
 * Failures (services runtime not available pre-activation, or in unit tests where no layer has been
 * set) never reach the caller: `runFork` reports them on the forked fiber instead of throwing, so
 * channel output stays best-effort for the sync `void` callers of `writeToDebuggerOutputWindow`.
 */
const appendAndShowChannelOutput = (message: string): void => {
  getRuntime().runFork(Effect.ignoreLogged(appendAndShow(message)));
};

export const writeToDebuggerOutputWindow = (
  output: string,
  showVSCodeWindow?: boolean,
  vsCodeWindowType?: VSCodeWindowTypeEnum
) => {
  appendAndShowChannelOutput(output);
  if (showVSCodeWindow && vsCodeWindowType) {
    switch (vsCodeWindowType) {
      case VSCodeWindowTypeEnum.Error: {
        vscode.window.showErrorMessage(output);
        break;
      }
      case VSCodeWindowTypeEnum.Informational: {
        vscode.window.showInformationMessage(output);
        break;
      }
      case VSCodeWindowTypeEnum.Warning: {
        vscode.window.showWarningMessage(output);
        break;
      }
    }
  }
};
