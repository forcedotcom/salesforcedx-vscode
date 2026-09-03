/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { LAST_OPENED_LOG_FOLDER_KEY, LAST_OPENED_LOG_KEY } from '../../src/debuggerConstants';

jest.mock('../../src/activation/getDialogStartingPath', () => ({
  getDialogStartingPath: jest.fn()
}));
jest.mock('../../src/adapter/debugConfigurationProvider', () => ({
  DebugConfigurationProvider: jest.fn()
}));
jest.mock('../../src/breakpoints/checkpointService', () => ({
  checkpointService: {},
  processBreakpointChangedForCheckpoints: jest.fn(),
  sfCreateCheckpoints: jest.fn(),
  sfToggleCheckpoint: jest.fn()
}));
jest.mock('../../src/channels', () => ({
  appendAndShowChannelOutput: jest.fn(),
  getDebuggerOutputChannel: Effect.succeed({ dispose: jest.fn() })
}));
jest.mock('../../src/commands/anonApexDebug', () => ({ anonApexDebug: jest.fn() }));
jest.mock('../../src/commands/launchApexReplayDebuggerWithCurrentFile', () => ({
  launchApexReplayDebuggerWithCurrentFile: jest.fn()
}));
jest.mock('../../src/commands/launchFromLogFile', () => ({ launchFromLogFile: jest.fn() }));
jest.mock('../../src/commands/quickLaunch', () => ({ setupAndDebugTests: jest.fn() }));
jest.mock('../../src/services/runtime', () => ({
  disposeRuntime: jest.fn(),
  getRuntime: () => ({})
}));
jest.mock('@salesforce/salesforcedx-utils-vscode', () => ({
  TelemetryService: {
    getInstance: () => ({
      initializeService: jest.fn().mockResolvedValue(undefined),
      sendEventData: jest.fn(),
      sendExtensionDeactivationEvent: jest.fn()
    })
  }
}));

type RegisteredCommand = (...args: unknown[]) => Effect.Effect<unknown, unknown, never>;

const mockApexExtension = { isActive: true, exports: {} };
(vscode.extensions.getExtension as jest.Mock).mockReturnValue(mockApexExtension);

const { activateEffect } = jest.requireActual('../../src/index') as typeof import('../../src/index');
const { getDialogStartingPath } = jest.requireMock('../../src/activation/getDialogStartingPath') as {
  getDialogStartingPath: jest.Mock;
};
const { launchFromLogFile } = jest.requireMock('../../src/commands/launchFromLogFile') as {
  launchFromLogFile: jest.Mock;
};

describe('Apex Replay Debugger activation', () => {
  const dialogStartingPath = URI.file('/workspace/.sfdx/tools/debug/logs');
  const registeredCommands = new Map<string, RegisteredCommand>();
  const registerCommandWithRuntime = jest.fn((command: string, handler: RegisteredCommand) => {
    registeredCommands.set(command, handler);
    return Effect.void;
  });
  const registerCommandWithRuntimeFactory = jest.fn(() => registerCommandWithRuntime);
  const workspaceStateGet = jest.fn();
  const workspaceStateUpdate = jest.fn().mockResolvedValue(undefined);
  const extensionContext = {
    subscriptions: [],
    workspaceState: {
      get: workspaceStateGet,
      update: workspaceStateUpdate
    }
  } as unknown as vscode.ExtensionContext;
  const runActivation = () =>
    Effect.runPromise(
      activateEffect(extensionContext).pipe(
        Effect.provideService(ExtensionProviderService, {
          getServicesApi: Effect.succeed({
            services: {
              registerCommandWithRuntime: registerCommandWithRuntimeFactory
            }
          })
        } as unknown as ExtensionProviderService)
      ) as Effect.Effect<void, unknown, never>
    );
  const runCommand = (command: string, ...args: unknown[]) =>
    Effect.runPromise(registeredCommands.get(command)!(...args));

  beforeEach(async () => {
    registeredCommands.clear();
    registerCommandWithRuntimeFactory.mockImplementation(() => registerCommandWithRuntime);
    registerCommandWithRuntime.mockImplementation((command: string, handler: RegisteredCommand) => {
      registeredCommands.set(command, handler);
      return Effect.void;
    });
    getDialogStartingPath.mockReturnValue(Effect.succeed(dialogStartingPath));
    launchFromLogFile.mockResolvedValue(undefined);
    workspaceStateGet.mockImplementation((key: string) => (key === LAST_OPENED_LOG_KEY ? '/logs/last.log' : undefined));
    workspaceStateUpdate.mockResolvedValue(undefined);

    (vscode.commands.registerCommand as jest.Mock).mockReturnValue({ dispose: jest.fn() });
    (vscode as unknown as { debug: Record<string, jest.Mock> }).debug = {
      onDidChangeBreakpoints: jest.fn().mockReturnValue({ dispose: jest.fn() }),
      onDidReceiveDebugSessionCustomEvent: jest.fn().mockReturnValue({ dispose: jest.fn() }),
      registerDebugConfigurationProvider: jest.fn().mockReturnValue({ dispose: jest.fn() })
    };
    (vscode.Disposable as unknown as { from: jest.Mock }).from = jest.fn().mockReturnValue({ dispose: jest.fn() });
    (vscode.window as unknown as { registerTreeDataProvider: jest.Mock }).registerTreeDataProvider = jest
      .fn()
      .mockReturnValue({ dispose: jest.fn() });
    (vscode.window as unknown as { showOpenDialog: jest.Mock }).showOpenDialog = jest.fn();
    Object.defineProperty(vscode.window, 'activeTextEditor', { value: undefined, configurable: true });

    await runActivation();
  });

  it('registers only the log-file commands through the Effect command service', () => {
    expect(registerCommandWithRuntimeFactory).toHaveBeenCalledWith(expect.anything(), { returnEffectResult: true });
    expect([...registeredCommands.keys()]).toEqual([
      'extension.replay-debugger.getLogFileName',
      'sf.launch.replay.debugger.logfile',
      'sf.launch.replay.debugger.logfile.path',
      'sf.launch.replay.debugger.last.logfile'
    ]);
    expect(vscode.commands.registerCommand).not.toHaveBeenCalledWith(
      expect.stringMatching(/replay-debugger\.getLogFileName|replay\.debugger\.(logfile|last\.logfile)/),
      expect.anything()
    );
  });

  it('prompts for a log file and remembers the selected file', async () => {
    const selectedLog = URI.file('/logs/selected.log');
    (vscode.window.showOpenDialog as jest.Mock).mockResolvedValue([selectedLog]);

    await expect(runCommand('extension.replay-debugger.getLogFileName')).resolves.toBe(selectedLog.fsPath);

    expect(vscode.window.showOpenDialog).toHaveBeenCalledWith({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      defaultUri: dialogStartingPath
    });
    expect(workspaceStateUpdate).toHaveBeenCalledWith(LAST_OPENED_LOG_KEY, selectedLog.fsPath);
    expect(workspaceStateUpdate).toHaveBeenCalledWith(LAST_OPENED_LOG_FOLDER_KEY, '/logs');
  });

  it('launches and remembers the supplied log URI', async () => {
    const selectedLog = URI.file('/logs/supplied.log');

    await runCommand('sf.launch.replay.debugger.logfile', selectedLog);

    expect(workspaceStateUpdate).toHaveBeenCalledWith(LAST_OPENED_LOG_KEY, selectedLog.fsPath);
    expect(workspaceStateUpdate).toHaveBeenCalledWith(LAST_OPENED_LOG_FOLDER_KEY, '/logs');
    expect(launchFromLogFile).toHaveBeenCalledWith(selectedLog.fsPath);
  });

  it('launches a log path with the anonymous Apex arguments', async () => {
    await runCommand('sf.launch.replay.debugger.logfile.path', '/logs/debug.log', '/scripts/test.apex', 3);

    expect(launchFromLogFile).toHaveBeenCalledWith('/logs/debug.log', true, '/scripts/test.apex', 3);
  });

  it('launches the last opened log file', async () => {
    await runCommand('sf.launch.replay.debugger.last.logfile');

    expect(workspaceStateGet).toHaveBeenCalledWith(LAST_OPENED_LOG_KEY);
    expect(launchFromLogFile).toHaveBeenCalledWith('/logs/last.log');
  });
});
