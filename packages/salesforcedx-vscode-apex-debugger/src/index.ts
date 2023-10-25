/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  DEBUGGER_TYPE,
  EXCEPTION_BREAKPOINT_BREAK_MODE_ALWAYS,
  EXCEPTION_BREAKPOINT_BREAK_MODE_NEVER,
  EXCEPTION_BREAKPOINT_REQUEST,
  HOTSWAP_REQUEST,
  LIST_EXCEPTION_BREAKPOINTS_REQUEST,
  LIVESHARE_DEBUG_TYPE_REQUEST,
  LIVESHARE_DEBUGGER_TYPE,
  SetExceptionBreakpointsArguments,
  SHOW_MESSAGE_EVENT,
  VscodeDebuggerMessage,
  VscodeDebuggerMessageType
} from '@salesforce/salesforcedx-apex-debugger/out/src';
import * as vscode from 'vscode';
import { DebugProtocol } from 'vscode-debugprotocol';
import { DebugConfigurationProvider } from './adapter/debugConfigurationProvider';
import { registerIsvAuthWatcher, setupGlobalDefaultUserIsvAuth } from './context';
import { nls } from './messages';
import { telemetryService } from './telemetry';

const cachedExceptionBreakpoints: Map<
  string,
  ExceptionBreakpointItem
> = new Map();
const sfdxCoreExtension = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
);

export async function getDebuggerType(
  session: vscode.DebugSession
): Promise<string> {
  let type = session.type;
  if (type === LIVESHARE_DEBUGGER_TYPE) {
    type = await session.customRequest(LIVESHARE_DEBUG_TYPE_REQUEST);
  }
  return type;
}

function registerCommands(): vscode.Disposable {
  const customEventHandler = vscode.debug.onDidReceiveDebugSessionCustomEvent(
    async event => {
      if (event && event.session) {
        const type = await getDebuggerType(event.session);
        if (type === DEBUGGER_TYPE && event.event === SHOW_MESSAGE_EVENT) {
          const eventBody = event.body as VscodeDebuggerMessage;
          if (eventBody && eventBody.type && eventBody.message) {
            switch (eventBody.type as VscodeDebuggerMessageType) {
              case VscodeDebuggerMessageType.Info: {
                void vscode.window.showInformationMessage(eventBody.message);
                break;
              }
              case VscodeDebuggerMessageType.Warning: {
                void vscode.window.showWarningMessage(eventBody.message);
                break;
              }
              case VscodeDebuggerMessageType.Error: {
                void vscode.window.showErrorMessage(eventBody.message);
                break;
              }
            }
          }
        }
      }
    }
  );
  const exceptionBreakpointCmd = vscode.commands.registerCommand(
    'sfdx.debug.exception.breakpoint',
    configureExceptionBreakpoint
  );
  const startSessionHandler = vscode.debug.onDidStartDebugSession(session => {
    cachedExceptionBreakpoints.forEach(breakpoint => {
      const args: SetExceptionBreakpointsArguments = {
        exceptionInfo: breakpoint
      };
      void session.customRequest(EXCEPTION_BREAKPOINT_REQUEST, args);
    });
  });

  return vscode.Disposable.from(
    customEventHandler,
    exceptionBreakpointCmd,
    startSessionHandler
  );
}

export interface ExceptionBreakpointItem extends vscode.QuickPickItem {
  typeref: string;
  breakMode: DebugProtocol.ExceptionBreakMode;
  uri?: string;
}

interface BreakModeItem extends vscode.QuickPickItem {
  breakMode: DebugProtocol.ExceptionBreakMode;
}

const EXCEPTION_BREAK_MODES: BreakModeItem[] = [
  {
    label: nls.localize('always_break_text'),
    description: '',
    breakMode: EXCEPTION_BREAKPOINT_BREAK_MODE_ALWAYS
  },
  {
    label: nls.localize('never_break_text'),
    description: '',
    breakMode: EXCEPTION_BREAKPOINT_BREAK_MODE_NEVER
  }
];

async function configureExceptionBreakpoint(): Promise<void> {
  const sfdxApex = vscode.extensions.getExtension(
    'salesforce.salesforcedx-vscode-apex'
  );
  if (sfdxApex && sfdxApex.exports) {
    const exceptionBreakpointInfos: ExceptionBreakpointItem[] = await sfdxApex.exports.getExceptionBreakpointInfo();
    console.log('Retrieved exception breakpoint info from language server');
    let enabledExceptionBreakpointTyperefs: string[] = [];
    if (vscode.debug.activeDebugSession) {
      const responseBody = await vscode.debug.activeDebugSession.customRequest(
        LIST_EXCEPTION_BREAKPOINTS_REQUEST
      );
      if (responseBody && responseBody.typerefs) {
        enabledExceptionBreakpointTyperefs = responseBody.typerefs;
      }
    } else {
      enabledExceptionBreakpointTyperefs = Array.from(
        cachedExceptionBreakpoints.keys()
      );
    }
    const processedBreakpointInfos = mergeExceptionBreakpointInfos(
      exceptionBreakpointInfos,
      enabledExceptionBreakpointTyperefs
    );
    const selectExceptionOptions: vscode.QuickPickOptions = {
      placeHolder: nls.localize('select_exception_text'),
      matchOnDescription: true
    };
    const selectedException = await vscode.window.showQuickPick(
      processedBreakpointInfos,
      selectExceptionOptions
    );
    if (selectedException) {
      const selectBreakModeOptions: vscode.QuickPickOptions = {
        placeHolder: nls.localize('select_break_option_text'),
        matchOnDescription: true
      };
      const selectedBreakMode = await vscode.window.showQuickPick(
        EXCEPTION_BREAK_MODES,
        selectBreakModeOptions
      );
      if (selectedBreakMode) {
        selectedException.breakMode = selectedBreakMode.breakMode;
        const args: SetExceptionBreakpointsArguments = {
          exceptionInfo: selectedException
        };
        if (vscode.debug.activeDebugSession) {
          await vscode.debug.activeDebugSession.customRequest(
            EXCEPTION_BREAKPOINT_REQUEST,
            args
          );
        }
        updateExceptionBreakpointCache(selectedException);
      }
    }
  }
}

export function mergeExceptionBreakpointInfos(
  breakpointInfos: ExceptionBreakpointItem[],
  enabledBreakpointTyperefs: string[]
): ExceptionBreakpointItem[] {
  const processedBreakpointInfos: ExceptionBreakpointItem[] = [];
  if (enabledBreakpointTyperefs.length > 0) {
    for (let i = breakpointInfos.length - 1; i >= 0; i--) {
      if (enabledBreakpointTyperefs.indexOf(breakpointInfos[i].typeref) >= 0) {
        breakpointInfos[i].breakMode = EXCEPTION_BREAKPOINT_BREAK_MODE_ALWAYS;
        breakpointInfos[i].description = `$(stop) ${nls.localize(
          'always_break_text'
        )}`;
        processedBreakpointInfos.unshift(breakpointInfos[i]);
        breakpointInfos.splice(i, 1);
      }
    }
  }
  return processedBreakpointInfos.concat(breakpointInfos);
}

export function updateExceptionBreakpointCache(
  selectedException: ExceptionBreakpointItem
) {
  if (
    selectedException.breakMode === EXCEPTION_BREAKPOINT_BREAK_MODE_ALWAYS &&
    !cachedExceptionBreakpoints.has(selectedException.typeref)
  ) {
    cachedExceptionBreakpoints.set(
      selectedException.typeref,
      selectedException
    );
  } else if (
    selectedException.breakMode === EXCEPTION_BREAKPOINT_BREAK_MODE_NEVER &&
    cachedExceptionBreakpoints.has(selectedException.typeref)
  ) {
    cachedExceptionBreakpoints.delete(selectedException.typeref);
  }
}

export function getExceptionBreakpointCache(): Map<
  string,
  ExceptionBreakpointItem
> {
  return cachedExceptionBreakpoints;
}

function registerFileWatchers(): vscode.Disposable {
  const clsWatcher = vscode.workspace.createFileSystemWatcher('**/*.cls');
  clsWatcher.onDidChange(() => notifyDebuggerSessionFileChanged());
  clsWatcher.onDidCreate(() => notifyDebuggerSessionFileChanged());
  clsWatcher.onDidDelete(() => notifyDebuggerSessionFileChanged());
  const trgWatcher = vscode.workspace.createFileSystemWatcher('**/*.trigger');
  trgWatcher.onDidChange(() => notifyDebuggerSessionFileChanged());
  trgWatcher.onDidCreate(() => notifyDebuggerSessionFileChanged());
  trgWatcher.onDidDelete(() => notifyDebuggerSessionFileChanged());
  return vscode.Disposable.from(clsWatcher, trgWatcher);
}

function notifyDebuggerSessionFileChanged(): void {
  if (vscode.debug.activeDebugSession) {
    void vscode.debug.activeDebugSession.customRequest(HOTSWAP_REQUEST);
  }
}

export async function activate(extensionContext: vscode.ExtensionContext) {
  console.log('Apex Debugger Extension Activated');
  const extensionHRStart = process.hrtime();
  const commands = registerCommands();
  const fileWatchers = registerFileWatchers();
  extensionContext.subscriptions.push(commands, fileWatchers);
  extensionContext.subscriptions.push(
    vscode.debug.registerDebugConfigurationProvider(
      'apex',
      new DebugConfigurationProvider()
    )
  );

  if (sfdxCoreExtension && sfdxCoreExtension.exports) {
    if (sfdxCoreExtension.exports.isCLIInstalled()) {
      console.log('Setting up ISV Debugger environment variables');
      // register watcher for ISV authentication and setup default user for CLI
      // this is done in core because it shares access to GlobalCliEnvironment with the commands
      // (VS Code does not seem to allow sharing npm modules between extensions)
      try {
        registerIsvAuthWatcher(extensionContext);
        await setupGlobalDefaultUserIsvAuth();
      } catch (e) {
        console.error(e);
        void vscode.window.showWarningMessage(
          nls.localize('isv_debug_config_environment_error')
        );
      }
    }

    // Telemetry
    telemetryService.initializeService(
      sfdxCoreExtension.exports.telemetryService.getReporter(),
      sfdxCoreExtension.exports.telemetryService.isTelemetryEnabled()
    );
  }

  telemetryService.sendExtensionActivationEvent(extensionHRStart);
}

export function deactivate() {
  console.log('Apex Debugger Extension Deactivated');
  telemetryService.sendExtensionDeactivationEvent();
}
