/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { ApexLogService } from 'salesforcedx-vscode-services/src/core/apexLogService';
import { FsService } from 'salesforcedx-vscode-services/src/vscode/fsService';
import { PromptService } from 'salesforcedx-vscode-services/src/vscode/prompts/promptService';
import { WorkspaceService } from 'salesforcedx-vscode-services/src/vscode/workspaceService';
import * as vscode from 'vscode';
import { logGetCommand } from '../../../src/commands/logGet';

describe('logGetCommand', () => {
  it('fails early when no logs exist', async () => {
    const listLogs = jest.fn(() => Effect.succeed([]));
    const getLogBody = jest.fn();
    const writeFile = jest.fn();
    const showTextDocument = jest.fn();
    const getPromptService = jest.fn();
    const services = {
      ApexLogService: Effect.succeed({ listLogs, getLogBody }),
      FsService: { writeFile, showTextDocument },
      get PromptService() {
        return getPromptService();
      }
    };

    const exit = await Effect.runPromiseExit(
      logGetCommand().pipe(
        Effect.provideService(ApexLogService, { listLogs, getLogBody } as unknown as ApexLogService),
        Effect.provideService(FsService, { writeFile, showTextDocument } as unknown as FsService),
        Effect.provideService(PromptService, {} as unknown as PromptService),
        Effect.provideService(WorkspaceService, {} as unknown as WorkspaceService),
        Effect.provideService(ExtensionProviderService, {
          getServicesApi: Effect.succeed({ services })
        } as unknown as ExtensionProviderService)
      )
    );

    expect(listLogs).toHaveBeenCalledTimes(1);
    expect(exit).toMatchObject({
      _tag: 'Failure',
      cause: {
        error: {
          _tag: 'LogGetNoLogsError',
          message: 'No Apex debug logs found'
        }
      }
    });
    expect(getPromptService).not.toHaveBeenCalled();
    expect(vscode.window.showQuickPick).not.toHaveBeenCalled();
    expect(getLogBody).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
    expect(showTextDocument).not.toHaveBeenCalled();
  });
});
