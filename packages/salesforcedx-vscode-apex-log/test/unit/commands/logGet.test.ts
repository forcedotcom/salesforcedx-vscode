/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import {
  ApexLogService,
  FsService,
  PromptService,
  WorkspaceService,
  type SalesforceVSCodeServicesApiV2
} from '@salesforce/vscode-services/v2';
import * as vscode from 'vscode';
import { logGetCommand } from '../../../src/commands/logGet';

describe('logGetCommand', () => {
  it('fails early when no logs exist', async () => {
    const listLogs = vi.fn(() => Effect.succeed([]));
    const getLogBody = vi.fn();
    const writeFile = vi.fn();
    const showTextDocument = vi.fn();
    const getPromptService = vi.fn();
    const servicesApi = {
      v2: { services: { ApexLogService, FsService, PromptService, WorkspaceService } }
    } as unknown as SalesforceVSCodeServicesApiV2;

    const exit = await Effect.runPromiseExit(
      logGetCommand().pipe(
        Effect.provideService(ApexLogService, { listLogs, getLogBody } as unknown as ApexLogService['Service']),
        Effect.provideService(FsService, { writeFile, showTextDocument } as unknown as FsService['Service']),
        Effect.provideService(PromptService, {} as unknown as PromptService['Service']),
        Effect.provideService(WorkspaceService, {} as unknown as WorkspaceService['Service']),
        Effect.provideService(ExtensionProviderService, {
          getServicesApi: Effect.succeed(servicesApi)
        } as unknown as ExtensionProviderService['Service'])
      ) as Effect.Effect<void, unknown, never>
    );

    expect(listLogs).toHaveBeenCalledTimes(1);
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(JSON.stringify(exit.cause)).toContain('LogGetNoLogsError');
      expect(JSON.stringify(exit.cause)).toContain('No Apex debug logs found');
    }
    expect(getPromptService).not.toHaveBeenCalled();
    expect(vscode.window.showQuickPick).not.toHaveBeenCalled();
    expect(getLogBody).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
    expect(showTextDocument).not.toHaveBeenCalled();
  });
});
