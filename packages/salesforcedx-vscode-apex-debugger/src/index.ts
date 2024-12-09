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
  isMetric,
  LIST_EXCEPTION_BREAKPOINTS_REQUEST,
  LIVESHARE_DEBUG_TYPE_REQUEST,
  LIVESHARE_DEBUGGER_TYPE,
  SEND_METRIC_EVENT,
  SetExceptionBreakpointsArguments,
  SHOW_MESSAGE_EVENT,
  VscodeDebuggerMessage,
  VscodeDebuggerMessageType
} from '@salesforce/salesforcedx-apex-debugger/out/src';
import { DebugProtocol } from '@vscode/debugprotocol';
import * as vscode from 'vscode';
import { DebugConfigurationProvider } from './adapter/debugConfigurationProvider';
import { registerIsvAuthWatcher, setupGlobalDefaultUserIsvAuth } from './context';
import { nls } from './messages';
import { telemetryService } from './telemetry';

const cachedExceptionBreakpoints: Map<string, ExceptionBreakpointItem> = new Map();
const salesforceCoreExtension = vscode.extensions.getExtension('salesforce.salesforcedx-vscode-core');

export const getDebuggerType = async (session: vscode.DebugSession): Promise<string> => {
  let type = session.type;
  if (type === LIVESHARE_DEBUGGER_TYPE) {
    type = await session.customRequest(LIVESHARE_DEBUG_TYPE_REQUEST);
  }
  return type;
};

const registerCommands = (): vscode.Disposable => {
  const customEventHandler = vscode.debug.onDidReceiveDebugSessionCustomEvent(async event => {
    if (event && event.session) {
      const type = await getDebuggerType(event.session);
      if (type === DEBUGGER_TYPE && event.event === SHOW_MESSAGE_EVENT) {
        const eventBody = event.body as VscodeDebuggerMessage;
        if (eventBody && eventBody.type && eventBody.message) {
          switch (eventBody.type as VscodeDebuggerMessageType) {
            case VscodeDebuggerMessageType.Info: {
              vscode.window.showInformationMessage(eventBody.message);
              break;
            }
            case VscodeDebuggerMessageType.Warning: {
              vscode.window.showWarningMessage(eventBody.message);
              break;
            }
            case VscodeDebuggerMessageType.Error: {
              vscode.window.showErrorMessage(eventBody.message);
              break;
            }
          }
        }
      }
    }
  });
  const exceptionBreakpointCmd = vscode.commands.registerCommand(
    'sf.debug.exception.breakpoint',
    configureExceptionBreakpoint
  );
  const startSessionHandler = vscode.debug.onDidStartDebugSession(session => {
    cachedExceptionBreakpoints.forEach(breakpoint => {
      const args: SetExceptionBreakpointsArguments = {
        exceptionInfo: breakpoint
      };
      session.customRequest(EXCEPTION_BREAKPOINT_REQUEST, args);
    });
  });

  return vscode.Disposable.from(customEventHandler, exceptionBreakpointCmd, startSessionHandler);
};

export type ExceptionBreakpointItem = vscode.QuickPickItem & {
  typeref: string;
  breakMode: DebugProtocol.ExceptionBreakMode;
  uri?: string;
};

type BreakModeItem = vscode.QuickPickItem & {
  breakMode: DebugProtocol.ExceptionBreakMode;
};

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

const configureExceptionBreakpoint = async (): Promise<void> => {
  const salesforceApexExtension = vscode.extensions.getExtension('salesforce.salesforcedx-vscode-apex');
  if (salesforceApexExtension && salesforceApexExtension.exports) {
    const exceptionBreakpointInfos: ExceptionBreakpointItem[] =
      await salesforceApexExtension.exports.getExceptionBreakpointInfo();
    console.log('Retrieved exception breakpoint info from language server');
    let enabledExceptionBreakpointTyperefs: string[] = [];
    if (vscode.debug.activeDebugSession) {
      const responseBody = await vscode.debug.activeDebugSession.customRequest(LIST_EXCEPTION_BREAKPOINTS_REQUEST);
      if (responseBody && responseBody.typerefs) {
        enabledExceptionBreakpointTyperefs = responseBody.typerefs;
      }
    } else {
      enabledExceptionBreakpointTyperefs = Array.from(cachedExceptionBreakpoints.keys());
    }
    const processedBreakpointInfos = mergeExceptionBreakpointInfos(
      exceptionBreakpointInfos,
      enabledExceptionBreakpointTyperefs
    );
    const selectExceptionOptions: vscode.QuickPickOptions = {
      placeHolder: nls.localize('select_exception_text'),
      matchOnDescription: true
    };
    const selectedException = await vscode.window.showQuickPick(processedBreakpointInfos, selectExceptionOptions);
    if (selectedException) {
      const selectBreakModeOptions: vscode.QuickPickOptions = {
        placeHolder: nls.localize('select_break_option_text'),
        matchOnDescription: true
      };
      const selectedBreakMode = await vscode.window.showQuickPick(EXCEPTION_BREAK_MODES, selectBreakModeOptions);
      if (selectedBreakMode) {
        selectedException.breakMode = selectedBreakMode.breakMode;
        const args: SetExceptionBreakpointsArguments = {
          exceptionInfo: selectedException
        };
        if (vscode.debug.activeDebugSession) {
          await vscode.debug.activeDebugSession.customRequest(EXCEPTION_BREAKPOINT_REQUEST, args);
        }
        updateExceptionBreakpointCache(selectedException);
      }
    }
  }
};

export const mergeExceptionBreakpointInfos = (
  breakpointInfos: ExceptionBreakpointItem[],
  enabledBreakpointTyperefs: string[]
): ExceptionBreakpointItem[] => {
  const processedBreakpointInfos: ExceptionBreakpointItem[] = [];
  if (enabledBreakpointTyperefs.length > 0) {
    for (let i = breakpointInfos.length - 1; i >= 0; i--) {
      if (enabledBreakpointTyperefs.indexOf(breakpointInfos[i].typeref) >= 0) {
        breakpointInfos[i].breakMode = EXCEPTION_BREAKPOINT_BREAK_MODE_ALWAYS;
        breakpointInfos[i].description = `$(stop) ${nls.localize('always_break_text')}`;
        processedBreakpointInfos.unshift(breakpointInfos[i]);
        breakpointInfos.splice(i, 1);
      }
    }
  }
  return processedBreakpointInfos.concat(breakpointInfos);
};

export const updateExceptionBreakpointCache = (selectedException: ExceptionBreakpointItem) => {
  if (
    selectedException.breakMode === EXCEPTION_BREAKPOINT_BREAK_MODE_ALWAYS &&
    !cachedExceptionBreakpoints.has(selectedException.typeref)
  ) {
    cachedExceptionBreakpoints.set(selectedException.typeref, selectedException);
  } else if (
    selectedException.breakMode === EXCEPTION_BREAKPOINT_BREAK_MODE_NEVER &&
    cachedExceptionBreakpoints.has(selectedException.typeref)
  ) {
    cachedExceptionBreakpoints.delete(selectedException.typeref);
  }
};

export const getExceptionBreakpointCache = (): Map<string, ExceptionBreakpointItem> => {
  return cachedExceptionBreakpoints;
};

const registerFileWatchers = (): vscode.Disposable => {
  const clsWatcher = vscode.workspace.createFileSystemWatcher('**/*.cls');

  clsWatcher.onDidChange(uri => notifyDebuggerSessionFileChanged());
  clsWatcher.onDidCreate(uri => notifyDebuggerSessionFileChanged());
  clsWatcher.onDidDelete(uri => notifyDebuggerSessionFileChanged());
  const trgWatcher = vscode.workspace.createFileSystemWatcher('**/*.trigger');
  trgWatcher.onDidChange(uri => notifyDebuggerSessionFileChanged());
  trgWatcher.onDidCreate(uri => notifyDebuggerSessionFileChanged());
  trgWatcher.onDidDelete(uri => notifyDebuggerSessionFileChanged());

  return vscode.Disposable.from(clsWatcher, trgWatcher);
};

const notifyDebuggerSessionFileChanged = (): void => {
  if (vscode.debug.activeDebugSession) {
    vscode.debug.activeDebugSession.customRequest(HOTSWAP_REQUEST);
  }
};

// NOTE: The below function is created for salesforcedx-apex-debugger to use the debugger extension as a middleman to send info to outside sources. The info is sent via events, which the debugger extension, as an event handler, is subscribed to and continuously listens for. One use case for this event handling mechanism that is currently implemented is sending telemetry to AppInsights, which is the `event.event === SEND_METRIC_EVENT` if statement block. In the future, this registerDebugHandlers() function might be used for other purposes, such as sending `console.log()` messages - salesforcedx-apex-debugger does not have access to the console in Toggle Developer Tools, and thus debug logging is currently limited to sending to the Debug Console in the bottom panel.
const registerDebugHandlers = (): vscode.Disposable => {
  const customEventHandler = vscode.debug.onDidReceiveDebugSessionCustomEvent(async event => {
    if (event?.session) {
      const type = await getDebuggerType(event.session);
      if (type !== DEBUGGER_TYPE) {
        return;
      }

      if (event.event === SEND_METRIC_EVENT && isMetric(event.body)) {
        telemetryService.sendMetricEvent(event);
      }
    }
  });

  return vscode.Disposable.from(customEventHandler);
};

export const activate = async (extensionContext: vscode.ExtensionContext): Promise<void> => {
  console.log('Apex Debugger Extension Activated');
  const extensionHRStart = process.hrtime();
  const commands = registerCommands();
  const debugHandlers = registerDebugHandlers();
  const fileWatchers = registerFileWatchers();
  extensionContext.subscriptions.push(commands, fileWatchers, debugHandlers);
  extensionContext.subscriptions.push(
    vscode.debug.registerDebugConfigurationProvider('apex', new DebugConfigurationProvider())
  );

  if (salesforceCoreExtension && salesforceCoreExtension.exports) {
    if (salesforceCoreExtension.exports.isCLIInstalled()) {
      console.log('Setting up ISV Debugger environment variables');
      // register watcher for ISV authentication and setup default user for CLI
      // this is done in core because it shares access to GlobalCliEnvironment with the commands
      // (VS Code does not seem to allow sharing npm modules between extensions)
      try {
        registerIsvAuthWatcher(extensionContext);
        await setupGlobalDefaultUserIsvAuth();
      } catch (e) {
        console.error(e);
        vscode.window.showWarningMessage(nls.localize('isv_debug_config_environment_error'));
      }
    }

    // Telemetry
    telemetryService.initializeService(
      salesforceCoreExtension.exports.telemetryService.getReporters(),
      salesforceCoreExtension.exports.telemetryService.isTelemetryEnabled()
    );
  }

  telemetryService.sendExtensionActivationEvent(extensionHRStart);
};

export const deactivate = () => {
  console.log('Apex Debugger Extension Deactivated');
  telemetryService.sendExtensionDeactivationEvent();
};
