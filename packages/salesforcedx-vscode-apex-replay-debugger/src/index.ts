/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable @typescript-eslint/consistent-type-assertions */

import {
  MetricError,
  MetricGeneral,
  MetricLaunch,
  DEBUGGER_TYPE,
  LAST_OPENED_LOG_FOLDER_KEY,
  LAST_OPENED_LOG_KEY,
  LIVESHARE_DEBUG_TYPE_REQUEST,
  LIVESHARE_DEBUGGER_TYPE,
  SEND_METRIC_GENERAL_EVENT,
  SEND_METRIC_ERROR_EVENT,
  SEND_METRIC_LAUNCH_EVENT
} from '@salesforce/salesforcedx-apex-replay-debugger';
import { ActivationTracker, TelemetryService } from '@salesforce/salesforcedx-utils-vscode';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { getDialogStartingPath } from './activation/getDialogStartingPath';
import { DebugConfigurationProvider } from './adapter/debugConfigurationProvider';
import {
  checkpointService,
  processBreakpointChangedForCheckpoints,
  createCheckpoints,
  sfToggleCheckpoint
} from './breakpoints/checkpointService';
import { launchFromLogFile } from './commands/launchFromLogFile';
import { setupAndDebugTests } from './commands/quickLaunch';
import { getActiveSalesforceCoreExtension } from './utils/extensionApis';

let extContext: vscode.ExtensionContext;

const registerCommands = async (): Promise<vscode.Disposable> => {
  const dialogStartingPathUri = await getDialogStartingPath(extContext);
  const promptForLogCmd = vscode.commands.registerCommand('extension.replay-debugger.getLogFileName', async () => {
    const fileUris: URI[] | undefined = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      defaultUri: dialogStartingPathUri
    });
    if (fileUris && fileUris.length === 1) {
      updateLastOpened(extContext, fileUris[0].fsPath);
      return fileUris[0].fsPath;
    }
  });
  const launchFromLogFileCmd = vscode.commands.registerCommand(
    'sf.launch.replay.debugger.logfile',
    async (editorUri: URI) => {
      const resolved = editorUri ?? vscode.window.activeTextEditor?.document.uri;

      if (resolved) {
        updateLastOpened(extContext, resolved.fsPath);
      }
      await launchFromLogFile(resolved?.fsPath);
    }
  );

  const launchFromLogFilePathCmd = vscode.commands.registerCommand(
    'sf.launch.replay.debugger.logfile.path',
    async logFilePath => {
      if (logFilePath && typeof logFilePath === 'string') {
        await launchFromLogFile(logFilePath, true);
      }
    }
  );

  const launchFromLastLogFileCmd = vscode.commands.registerCommand(
    'sf.launch.replay.debugger.last.logfile',
    async () => {
      const lastOpenedLog = extContext.workspaceState.get<string>(LAST_OPENED_LOG_KEY);
      await launchFromLogFile(lastOpenedLog);
    }
  );

  return vscode.Disposable.from(
    promptForLogCmd,
    launchFromLogFileCmd,
    launchFromLogFilePathCmd,
    launchFromLastLogFileCmd,
    vscode.commands.registerCommand('sf.create.checkpoints', createCheckpoints),
    vscode.commands.registerCommand('sf.toggle.checkpoint', sfToggleCheckpoint)
  );
};

export const updateLastOpened = (extensionContext: vscode.ExtensionContext, logPath: string) => {
  extensionContext.workspaceState.update(LAST_OPENED_LOG_KEY, logPath);
  extensionContext.workspaceState.update(LAST_OPENED_LOG_FOLDER_KEY, path.dirname(logPath));
};

export const getDebuggerType = async (session: vscode.DebugSession): Promise<string> =>
  session.type === LIVESHARE_DEBUGGER_TYPE
    ? ((await session.customRequest(LIVESHARE_DEBUG_TYPE_REQUEST)) as string)
    : session.type;

const registerDebugHandlers = (): vscode.Disposable => {
  const customEventHandler = vscode.debug.onDidReceiveDebugSessionCustomEvent(async event => {
    if (event?.session) {
      const type = await getDebuggerType(event.session);
      if (type !== DEBUGGER_TYPE) {
        return;
      }

      if (event.event === SEND_METRIC_LAUNCH_EVENT && event.body) {
        const metricLaunchArgs = event.body as MetricLaunch;
        TelemetryService.getInstance().sendEventData('apexReplayDebugger.launch', {
          logSize: metricLaunchArgs.logSize.toString(),
          errorSubject: metricLaunchArgs.error.subject
        });
      } else if (event.event === SEND_METRIC_ERROR_EVENT && event.body) {
        const metricErrorArgs = event.body as MetricError;
        TelemetryService.getInstance().sendEventData('apexReplayDebugger.error', {
          subject: metricErrorArgs.subject,
          callstack: metricErrorArgs.callstack
        });
      } else if (event.event === SEND_METRIC_GENERAL_EVENT && event.body) {
        const metricGeneralArgs = event.body as MetricGeneral;
        TelemetryService.getInstance().sendEventData('apexReplayDebugger.general', {
          subject: metricGeneralArgs.subject,
          type: metricGeneralArgs.type,
          qty: metricGeneralArgs.qty?.toString() ?? 'undefined'
        });
      }
    }
  });

  return vscode.Disposable.from(customEventHandler);
};

export const activate = async (extensionContext: vscode.ExtensionContext) => {
  extContext = extensionContext;
  const commands = await registerCommands();
  const debugHandlers = registerDebugHandlers();
  const debugConfigProvider = vscode.debug.registerDebugConfigurationProvider(
    'apex-replay',
    new DebugConfigurationProvider()
  );
  const checkpointsView = vscode.window.registerTreeDataProvider('sf.view.checkpoint', checkpointService);
  const breakpointsSub = vscode.debug.onDidChangeBreakpoints(processBreakpointChangedForCheckpoints);

  const salesforceCoreExtension = await getActiveSalesforceCoreExtension();

  // Workspace Context
  await salesforceCoreExtension.services.WorkspaceContext.getInstance().initialize(extensionContext);

  // Debug Tests command
  const debugTests = vscode.commands.registerCommand('sf.test.view.debugTests', async (test: { name: string }) => {
    await setupAndDebugTests(test.name);
  });

  // Debug Single Test command
  const debugTest = vscode.commands.registerCommand('sf.test.view.debugSingleTest', async (test: { name: string }) => {
    const [method, className, namespace] = test.name.split('.').toReversed();
    await setupAndDebugTests(namespace ? `${namespace}.${className}` : className, method);
  });

  extensionContext.subscriptions.push(
    commands,
    debugHandlers,
    debugConfigProvider,
    checkpointsView,
    breakpointsSub,
    debugTests,
    debugTest
  );

  // Telemetry
  const telemetryService = TelemetryService.getInstance();
  await telemetryService.initializeService(extensionContext);
  const activationTracker = new ActivationTracker(extensionContext, telemetryService);
  await activationTracker.markActivationStop();
};

export const deactivate = () => {
  console.log('Apex Replay Debugger Extension Deactivated');
  // Send deactivation event using shared service
  TelemetryService.getInstance().sendExtensionDeactivationEvent();
};
