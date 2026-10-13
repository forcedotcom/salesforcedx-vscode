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
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { updateLastOpened } from './activation/getDialogStartingPath';
import { DebugConfigurationProvider } from './adapter/debugConfigurationProvider';
import { salesforceApexExtension } from './apexExtension';
import {
  checkpointService,
  processBreakpointChangedForCheckpoints,
  sfCreateCheckpointsCommand,
  sfToggleCheckpointCommand
} from './breakpoints/checkpointService';
import { getDebuggerOutputChannel } from './channels';
import { anonApexDebugCommand } from './commands/anonApexDebug';
import { launchApexReplayDebuggerWithCurrentFileCommand } from './commands/launchApexReplayDebuggerWithCurrentFile';
import { launchFromLogFile } from './commands/launchFromLogFile';
import { setupAndDebugTests } from './commands/quickLaunch';
import {
  DEBUGGER_TYPE,
  LAST_OPENED_LOG_KEY,
  LIVESHARE_DEBUG_TYPE_REQUEST,
  LIVESHARE_DEBUGGER_TYPE
} from './debuggerConstants';
import { nls } from './messages';
import { buildAllServicesLayer, setAllServicesLayer } from './services/extensionProvider';
import { disposeRuntime, getRuntime } from './services/runtime';

export { retrieveLineBreakpointInfo } from './apexExtension';
export { writeToDebuggerOutputWindow } from './channels';

const launchFromLogFileCommand = Effect.fn('ApexReplayDebugger.launchFromLogFileCommand')(function* (
  extensionContext: vscode.ExtensionContext,
  editorUri?: URI
) {
  const resolved = editorUri ?? vscode.window.activeTextEditor?.document.uri;
  if (resolved) updateLastOpened(extensionContext, resolved);
  yield* Effect.promise(() => launchFromLogFile(resolved?.fsPath));
});

const launchFromLastLogFileCommand = Effect.fn('ApexReplayDebugger.launchFromLastLogFileCommand')(function* (
  extensionContext: vscode.ExtensionContext
) {
  yield* Effect.promise(() => launchFromLogFile(extensionContext.workspaceState.get<string>(LAST_OPENED_LOG_KEY)));
});

const debugTestsCommand = Effect.fn('ApexReplayDebugger.debugTestsCommand')(function* (test: { name: string }) {
  yield* Effect.promise(() => setupAndDebugTests(test.name));
});

const debugSingleTestCommand = Effect.fn('ApexReplayDebugger.debugSingleTestCommand')(function* (test: {
  name: string;
}) {
  const [method, className, namespace] = test.name.split('.').toReversed();
  yield* Effect.promise(() => setupAndDebugTests(namespace ? `${namespace}.${className}` : className, method));
});

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
  const registerCommand = (yield* (yield* ExtensionProviderService).getServicesApi).services.registerCommandWithRuntime(
    getRuntime()
  );
  yield* registerCommand('sf.create.checkpoints', sfCreateCheckpointsCommand);
  yield* registerCommand('sf.toggle.checkpoint', sfToggleCheckpointCommand);
  yield* registerCommand('sf.launch.replay.debugger.logfile', (editorUri?: URI) =>
    launchFromLogFileCommand(extensionContext, editorUri)
  );
  yield* registerCommand('sf.launch.replay.debugger.last.logfile', () =>
    launchFromLastLogFileCommand(extensionContext)
  );
  yield* registerCommand('sf.anon.apex.debug.delegate', anonApexDebugCommand);
  yield* registerCommand('sf.apex.debug.document', anonApexDebugCommand);
  yield* registerCommand('sf.launch.apex.replay.debugger.with.current.file', () =>
    launchApexReplayDebuggerWithCurrentFileCommand(extensionContext)
  );
  yield* registerCommand('sf.test.view.debugTests', debugTestsCommand);
  yield* registerCommand('sf.test.view.debugSingleTest', debugSingleTestCommand);

  const debugHandlers = registerDebugHandlers();
  const debugConfigProvider = vscode.debug.registerDebugConfigurationProvider(
    'apex-replay',
    new DebugConfigurationProvider(extensionContext)
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

  extensionContext.subscriptions.push(
    debuggerChannel,
    debugHandlers,
    debugConfigProvider,
    checkpointsView,
    breakpointsSub
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
