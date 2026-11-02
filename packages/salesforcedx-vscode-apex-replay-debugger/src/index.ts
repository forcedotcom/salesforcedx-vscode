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
import {
  checkpointService,
  processBreakpointChangedForCheckpoints,
  sfCreateCheckpointsCommand,
  sfToggleCheckpointCommand
} from './breakpoints/checkpointService';
import { refreshLineBreakpointMetadata } from './breakpoints/lineBreakpointMetadata';
import { getDebuggerOutputChannel } from './channels';
import { registerTestDebugCodeLensProducer } from './codelens/testDebugCodeLensProducer';
import { anonApexDebugCommand } from './commands/anonApexDebug';
import { launchApexReplayDebuggerWithCurrentFileCommand } from './commands/launchApexReplayDebuggerWithCurrentFile';
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

export { writeToDebuggerOutputWindow } from './channels';

const launchFromLogFileCommand = Effect.fn('ApexReplayDebugger.launchFromLogFileCommand')(function* (
  extensionContext: vscode.ExtensionContext,
  editorUri?: URI
) {
  let resolved = editorUri;
  if (!resolved) {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    resolved = yield* api.services.EditorService.getActiveEditorUri().pipe(
      Effect.catchTag('NoActiveEditorError', () => Effect.as(Effect.void, undefined))
    );
  }
  if (resolved) updateLastOpened(extensionContext, resolved);
  yield* launchFromLogFile(resolved?.fsPath);
});

const launchFromLastLogFileCommand = Effect.fn('ApexReplayDebugger.launchFromLastLogFileCommand')(function* (
  extensionContext: vscode.ExtensionContext
) {
  yield* launchFromLogFile(extensionContext.workspaceState.get<string>(LAST_OPENED_LOG_KEY));
});

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

const UPDATE_LINE_BREAKPOINT_INFO_REQUEST = 'apexReplayDebugger/updateLineBreakpointInfo';

const breakpointUris = (event: vscode.BreakpointsChangeEvent): string[] =>
  event.added.flatMap(breakpoint => {
    const sourceBreakpoint = breakpoint as vscode.SourceBreakpoint;
    return sourceBreakpoint.location?.uri.path.match(/\.(cls|trigger)$/i)
      ? [sourceBreakpoint.location.uri.toString()]
      : [];
  });

const refreshActiveReplayBreakpointMetadata = Effect.fn('ApexReplayDebugger.refreshBreakpointInformation')(function* (
  event: vscode.BreakpointsChangeEvent,
  replaySessions: ReadonlySet<vscode.DebugSession>
) {
  const uris = [...new Set(breakpointUris(event))];
  yield* Effect.logDebug('Refreshing Apex breakpoint information after breakpoint change', {
    uriCount: uris.length,
    replaySessionCount: replaySessions.size
  });
  const refreshed = yield* Effect.promise(() =>
    Promise.all(
      uris.map(async uri => {
        try {
          const lineBreakpointInfo = await refreshLineBreakpointMetadata(uri);
          await Promise.all(
            [...replaySessions].map(session =>
              session.customRequest(UPDATE_LINE_BREAKPOINT_INFO_REQUEST, { uri, lineBreakpointInfo })
            )
          );
          return true;
        } catch {
          return false;
        }
      })
    )
  );
  yield* Effect.logDebug('Finished refreshing Apex breakpoint information', {
    uriCount: uris.length,
    refreshedUriCount: refreshed.filter(Boolean).length
  });
  return refreshed.every(Boolean);
});

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
  const replaySessions = new Set<vscode.DebugSession>();
  let reportedBreakpointMetadataRefreshFailure = false;
  const startSessionSub = vscode.debug.onDidStartDebugSession(async session => {
    if ((await getDebuggerType(session)) === DEBUGGER_TYPE) replaySessions.add(session);
  });
  const endSessionSub = vscode.debug.onDidTerminateDebugSession(session => replaySessions.delete(session));
  const breakpointsSub = vscode.debug.onDidChangeBreakpoints(async event => {
    processBreakpointChangedForCheckpoints(event);
    const refreshed = await getRuntime().runPromise(refreshActiveReplayBreakpointMetadata(event, replaySessions));
    if (!refreshed && !reportedBreakpointMetadataRefreshFailure) {
      reportedBreakpointMetadataRefreshFailure = true;
      await vscode.window.showWarningMessage(nls.localize('apex_language_server_breakpoint_metadata_refresh_failed'));
    } else if (refreshed) {
      reportedBreakpointMetadataRefreshFailure = false;
    }
  });

  yield* registerTestDebugCodeLensProducer(extensionContext);

  extensionContext.subscriptions.push(
    debuggerChannel,
    debugHandlers,
    debugConfigProvider,
    checkpointsView,
    breakpointsSub,
    startSessionSub,
    endSessionSub
  );
});

export const deactivate = async (): Promise<void> => {
  await getRuntime().runPromise(deactivateEffect()).finally(disposeRuntime);
};

export const deactivateEffect = Effect.fn('deactivation:salesforcedx-vscode-apex-replay-debugger')(function* () {
  yield* Effect.log('Apex Replay Debugger Extension Deactivated');
});
