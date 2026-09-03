/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable @typescript-eslint/consistent-type-assertions */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import {
  MetricError,
  MetricGeneral,
  MetricLaunch,
  SEND_METRIC_GENERAL_EVENT,
  SEND_METRIC_ERROR_EVENT,
  SEND_METRIC_LAUNCH_EVENT
} from '@salesforce/salesforcedx-apex-replay-debugger';
import { TelemetryService } from '@salesforce/salesforcedx-utils-vscode';
import * as Effect from 'effect/Effect';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { getDialogStartingPath } from './activation/getDialogStartingPath';
import { DebugConfigurationProvider } from './adapter/debugConfigurationProvider';
import { salesforceApexExtension } from './apexExtension';
import {
  checkpointService,
  processBreakpointChangedForCheckpoints,
  sfCreateCheckpoints,
  sfToggleCheckpoint
} from './breakpoints/checkpointService';
import { getDebuggerOutputChannel } from './channels';
import { anonApexDebug } from './commands/anonApexDebug';
import { launchApexReplayDebuggerWithCurrentFile } from './commands/launchApexReplayDebuggerWithCurrentFile';
import { launchFromLogFile } from './commands/launchFromLogFile';
import { setupAndDebugTests } from './commands/quickLaunch';
import {
  DEBUGGER_TYPE,
  LAST_OPENED_LOG_FOLDER_KEY,
  LAST_OPENED_LOG_KEY,
  LIVESHARE_DEBUG_TYPE_REQUEST,
  LIVESHARE_DEBUGGER_TYPE
} from './debuggerConstants';
import { nls } from './messages';
import { buildAllServicesLayer, setAllServicesLayer } from './services/extensionProvider';
import { disposeRuntime, getRuntime } from './services/runtime';

export { retrieveLineBreakpointInfo } from './apexExtension';
export { writeToDebuggerOutputWindow } from './channels';

const registerCommands = Effect.fn('ApexReplayDebugger.registerCommands')(function* (
  extensionContext: vscode.ExtensionContext
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const registerCommand = api.services.registerCommandWithRuntime(getRuntime(), { returnEffectResult: true });
  const dialogStartingPathUri = yield* getDialogStartingPath(extensionContext);

  const promptForLogCommand = Effect.fn('ApexReplayDebugger.promptForLogCommand')(function* () {
    const fileUris: URI[] | undefined = yield* Effect.promise(() =>
      vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        defaultUri: dialogStartingPathUri
      })
    );
    if (fileUris?.length === 1) {
      yield* Effect.sync(() => updateLastOpened(extensionContext, fileUris[0].fsPath));
      return fileUris[0].fsPath;
    }
  });
  const launchFromLogFileCommand = Effect.fn('ApexReplayDebugger.launchFromLogFileCommand')(function* (editorUri: URI) {
    const resolved = editorUri ?? vscode.window.activeTextEditor?.document.uri;

    if (resolved) {
      yield* Effect.sync(() => updateLastOpened(extensionContext, resolved.fsPath));
    }
    yield* Effect.promise(() => launchFromLogFile(resolved?.fsPath));
  });
  const launchFromLogFilePathCommand = Effect.fn('ApexReplayDebugger.launchFromLogFilePathCommand')(function* (
    logFilePath: string | undefined,
    anonApexFilePath?: string,
    anonApexLineOffset?: number
  ) {
    if (logFilePath) {
      yield* Effect.promise(() => launchFromLogFile(logFilePath, true, anonApexFilePath, anonApexLineOffset));
    }
  });
  const launchFromLastLogFileCommand = Effect.fn('ApexReplayDebugger.launchFromLastLogFileCommand')(function* () {
    const lastOpenedLog = extensionContext.workspaceState.get<string>(LAST_OPENED_LOG_KEY);
    yield* Effect.promise(() => launchFromLogFile(lastOpenedLog));
  });

  yield* registerCommand('extension.replay-debugger.getLogFileName', promptForLogCommand);
  yield* registerCommand('sf.launch.replay.debugger.logfile', launchFromLogFileCommand);
  yield* registerCommand('sf.launch.replay.debugger.logfile.path', launchFromLogFilePathCommand);
  yield* registerCommand('sf.launch.replay.debugger.last.logfile', launchFromLastLogFileCommand);

  const sfCreateCheckpointsCmd = vscode.commands.registerCommand('sf.create.checkpoints', sfCreateCheckpoints);
  const sfToggleCheckpointCmd = vscode.commands.registerCommand('sf.toggle.checkpoint', sfToggleCheckpoint);

  const anonApexDebugDelegateCmd = vscode.commands.registerCommand('sf.anon.apex.debug.delegate', anonApexDebug);

  const launchApexReplayDebuggerWithCurrentFileCmd = vscode.commands.registerCommand(
    'sf.launch.apex.replay.debugger.with.current.file',
    launchApexReplayDebuggerWithCurrentFile
  );

  return vscode.Disposable.from(
    sfCreateCheckpointsCmd,
    sfToggleCheckpointCmd,
    anonApexDebugDelegateCmd,
    launchApexReplayDebuggerWithCurrentFileCmd
  );
});

export const updateLastOpened = (extensionContext: vscode.ExtensionContext, logPath: string) => {
  extensionContext.workspaceState.update(LAST_OPENED_LOG_KEY, logPath);
  extensionContext.workspaceState.update(LAST_OPENED_LOG_FOLDER_KEY, path.dirname(logPath));
};

export const getDebuggerType = async (session: vscode.DebugSession): Promise<string> => {
  let type = session.type;
  if (type === LIVESHARE_DEBUGGER_TYPE) {
    type = await session.customRequest(LIVESHARE_DEBUG_TYPE_REQUEST);
  }
  return type;
};

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
  setAllServicesLayer(buildAllServicesLayer(extensionContext, nls.localize('channel_name')));
  await getRuntime().runPromise(activateEffect(extensionContext));
};

export const activateEffect = Effect.fn('activation:salesforcedx-vscode-apex-replay-debugger')(function* (
  extensionContext: vscode.ExtensionContext
) {
  const commands = yield* registerCommands(extensionContext);
  const debugHandlers = registerDebugHandlers();
  const debugConfigProvider = vscode.debug.registerDebugConfigurationProvider(
    'apex-replay',
    new DebugConfigurationProvider()
  );
  // Resolve the services channel eagerly: it is created on first resolution, so without this
  // 'Apex Replay Debugger' is missing from the Output dropdown until the first debugger write.
  const debuggerChannel = yield* getDebuggerOutputChannel;
  const checkpointsView = vscode.window.registerTreeDataProvider('sf.view.checkpoint', checkpointService);
  const breakpointsSub = vscode.debug.onDidChangeBreakpoints(processBreakpointChangedForCheckpoints);

  // Activate Salesforce Apex Extension
  if (!salesforceApexExtension.isActive) {
    yield* Effect.promise(() => salesforceApexExtension.activate());
  }

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
    debuggerChannel,
    commands,
    debugHandlers,
    debugConfigProvider,
    checkpointsView,
    breakpointsSub,
    debugTests,
    debugTest
  );

  // Telemetry
  yield* Effect.promise(() => TelemetryService.getInstance().initializeService(extensionContext));
});

export const deactivate = async () => {
  await Promise.resolve()
    .then(() => {
      console.log('Apex Replay Debugger Extension Deactivated');
      // Send deactivation event using shared service
      TelemetryService.getInstance().sendExtensionDeactivationEvent();
    })
    .finally(disposeRuntime);
};
