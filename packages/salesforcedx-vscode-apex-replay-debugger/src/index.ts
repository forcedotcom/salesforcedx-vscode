/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable @typescript-eslint/consistent-type-assertions */

import { annotateRootSpan, ExtensionProviderService } from '@salesforce/effect-ext-utils';
import {
  type MetricError,
  type MetricGeneral,
  type MetricLaunch,
  SEND_METRIC_GENERAL_EVENT,
  SEND_METRIC_ERROR_EVENT,
  SEND_METRIC_LAUNCH_EVENT
} from '@salesforce/salesforcedx-apex-replay-debugger';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { type URI } from 'vscode-uri';
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
import { anonApexDebug } from './commands/anonApexDebug';
import { launchApexReplayDebuggerWithCurrentFile } from './commands/launchApexReplayDebuggerWithCurrentFile';
import { launchFromLogFile } from './commands/launchFromLogFile';
import { debugSingleTestCommand, debugTestsCommand } from './commands/quickLaunch';
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

const registerCommands = (extensionContext: vscode.ExtensionContext): vscode.Disposable => {
  const launchFromLogFileCmd = vscode.commands.registerCommand(
    'sf.launch.replay.debugger.logfile',
    async (editorUri: URI) => {
      const resolved = editorUri ?? vscode.window.activeTextEditor?.document.uri;

      if (resolved) {
        updateLastOpened(extensionContext, resolved);
      }
      await launchFromLogFile(resolved?.fsPath);
    }
  );

  const launchFromLastLogFileCmd = vscode.commands.registerCommand(
    'sf.launch.replay.debugger.last.logfile',
    async () => {
      const lastOpenedLog = extensionContext.workspaceState.get<string>(LAST_OPENED_LOG_KEY);
      await launchFromLogFile(lastOpenedLog);
    }
  );

  const anonApexDebugDelegateCmd = vscode.commands.registerCommand('sf.anon.apex.debug.delegate', anonApexDebug);

  const launchApexReplayDebuggerWithCurrentFileCmd = vscode.commands.registerCommand(
    'sf.launch.apex.replay.debugger.with.current.file',
    () => launchApexReplayDebuggerWithCurrentFile(extensionContext)
  );

  return vscode.Disposable.from(
    launchFromLogFileCmd,
    launchFromLastLogFileCmd,
    anonApexDebugDelegateCmd,
    launchApexReplayDebuggerWithCurrentFileCmd
  );
};

export const getDebuggerType = async (session: vscode.DebugSession): Promise<string> => {
  let type = session.type;
  if (type === LIVESHARE_DEBUGGER_TYPE) {
    type = await session.customRequest(LIVESHARE_DEBUG_TYPE_REQUEST);
  }
  return type;
};

export const emitLaunchMetric = Effect.fn('apexReplayDebugger.launch', { root: true })(function* (
  metric: MetricLaunch
) {
  yield* annotateRootSpan({
    logSize: metric.logSize.toString(),
    errorSubject: metric.error.subject
  });
});

export const emitErrorMetric = Effect.fn('apexReplayDebugger.error', { root: true })(function* (metric: MetricError) {
  yield* annotateRootSpan({ subject: metric.subject, callstack: metric.callstack });
});

export const emitGeneralMetric = Effect.fn('apexReplayDebugger.general', { root: true })(function* (
  metric: MetricGeneral
) {
  yield* annotateRootSpan({
    subject: metric.subject,
    type: metric.type,
    qty: metric.qty?.toString() ?? 'undefined'
  });
});

const registerDebugHandlers = (): vscode.Disposable => {
  const customEventHandler = vscode.debug.onDidReceiveDebugSessionCustomEvent(async event => {
    if (event?.session) {
      const type = await getDebuggerType(event.session);
      if (type !== DEBUGGER_TYPE) {
        return;
      }

      if (event.event === SEND_METRIC_LAUNCH_EVENT && event.body) {
        await getRuntime().runPromise(emitLaunchMetric(event.body as MetricLaunch));
      } else if (event.event === SEND_METRIC_ERROR_EVENT && event.body) {
        await getRuntime().runPromise(emitErrorMetric(event.body as MetricError));
      } else if (event.event === SEND_METRIC_GENERAL_EVENT && event.body) {
        await getRuntime().runPromise(emitGeneralMetric(event.body as MetricGeneral));
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
  yield* registerCommand('sf.test.view.debugTests', debugTestsCommand);
  yield* registerCommand('sf.test.view.debugSingleTest', debugSingleTestCommand);

  const commands = registerCommands(extensionContext);
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
    commands,
    debugHandlers,
    debugConfigProvider,
    checkpointsView,
    breakpointsSub
  );
});

export const deactivate = async (): Promise<void> => {
  await getRuntime().runPromise(deactivateEffect()).finally(disposeRuntime);
};

export const deactivateEffect = Effect.fn('deactivation:salesforcedx-vscode-apex-replay-debugger')(function* () {
  yield* Effect.sync(() => console.log('Apex Replay Debugger Extension Deactivated'));
});
