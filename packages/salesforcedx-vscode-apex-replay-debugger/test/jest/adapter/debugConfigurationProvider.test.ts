/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { UserCancellationError } from 'salesforcedx-vscode-services/src/vscode/prompts/promptService';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { DebugConfigurationProvider } from '../../../src/adapter/debugConfigurationProvider';
import { LAST_OPENED_LOG_FOLDER_KEY, LAST_OPENED_LOG_KEY } from '../../../src/debuggerConstants';
import { buildAllServicesLayer, setAllServicesLayer } from '../../../src/services/extensionProvider';
import { disposeRuntime } from '../../../src/services/runtime';

describe('DebugConfigurationProvider log-file prompt', () => {
  const readFile = jest.fn();
  const workspaceStateUpdate = jest.fn();
  const extensionContext = {
    workspaceState: { update: workspaceStateUpdate }
  } as unknown as vscode.ExtensionContext;

  beforeEach(() => {
    readFile.mockReturnValue(Effect.succeed('64.0 APEX_CODE,FINEST\n12:00:00.0|USER_INFO|[EXTERNAL]|005'));
    workspaceStateUpdate.mockResolvedValue(undefined);
    (vscode.window as unknown as { showOpenDialog: jest.Mock }).showOpenDialog = jest.fn();
    (vscode.window.showErrorMessage as jest.Mock).mockResolvedValue(undefined);
    (vscode.extensions.getExtension as jest.Mock).mockReturnValue(undefined);
    setAllServicesLayer(
      Layer.succeed(ExtensionProviderService, {
        getServicesApi: Effect.succeed({
          services: {
            FsService: { readFile },
            UserCancellationError,
            WorkspaceService: { getWorkspaceInfo: () => Effect.succeed({ isEmpty: true }) }
          }
        })
      } as unknown as ExtensionProviderService) as ReturnType<typeof buildAllServicesLayer>
    );
  });

  afterEach(disposeRuntime);

  it('reads and remembers the selected log file', async () => {
    const selectedLog = URI.file('/logs/selected.log');
    (vscode.window.showOpenDialog as jest.Mock).mockResolvedValue([selectedLog]);

    const resolved = await new DebugConfigurationProvider(extensionContext).resolveDebugConfiguration(undefined, {
      name: 'Prompt for log',
      type: 'apex-replay',
      request: 'launch',
      logFile: '${command:AskForLogFileName}'
    });

    expect(resolved).toMatchObject({
      logFileContents: '64.0 APEX_CODE,FINEST\n12:00:00.0|USER_INFO|[EXTERNAL]|005',
      logFilePath: selectedLog.fsPath,
      logFileName: 'selected.log'
    });
    expect(resolved).not.toHaveProperty('logFile');
    expect(workspaceStateUpdate).toHaveBeenCalledWith(LAST_OPENED_LOG_KEY, selectedLog.fsPath);
    expect(workspaceStateUpdate).toHaveBeenCalledWith(LAST_OPENED_LOG_FOLDER_KEY, '/logs');
  });

  it('silently cancels when no log file is selected', async () => {
    (vscode.window.showOpenDialog as jest.Mock).mockResolvedValue(undefined);

    const resolved = await new DebugConfigurationProvider(extensionContext).resolveDebugConfiguration(undefined, {
      name: 'Prompt for log',
      type: 'apex-replay',
      request: 'launch',
      logFile: '${command:AskForLogFileName}'
    });

    expect(resolved).toBeUndefined();
    expect(readFile).not.toHaveBeenCalled();
    expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
  });
});
