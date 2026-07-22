/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as vscode from 'vscode';
import { unsetDefaultOrgCommand } from '../../../src/commands/unsetDefaultOrg';

describe('unsetDefaultOrgCommand', () => {
  let unsetTargetOrgMock: jest.Mock;
  let showInformationMessageMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    unsetTargetOrgMock = jest.fn().mockReturnValue(Effect.void);
    showInformationMessageMock = vscode.window.showInformationMessage as unknown as jest.Mock;
    showInformationMessageMock.mockResolvedValue(undefined);
  });

  const run = (opts: { unsetTargetOrg: jest.Mock }) =>
    Effect.runPromiseExit(
      unsetDefaultOrgCommand().pipe(
        Effect.provideService(ExtensionProviderService, {
          getServicesApi: Effect.succeed({
            services: {
              ConfigService: {
                unsetTargetOrg: opts.unsetTargetOrg
              }
            }
          })
        } as unknown as ExtensionProviderService)
      ) as Effect.Effect<void, unknown, never>
    );

  it('calls ConfigService.unsetTargetOrg and shows a success notification', async () => {
    const exit = await run({ unsetTargetOrg: unsetTargetOrgMock });

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(unsetTargetOrgMock).toHaveBeenCalledTimes(1);
    expect(showInformationMessageMock).toHaveBeenCalledTimes(1);
    expect(showInformationMessageMock).toHaveBeenCalledWith('Successfully unset the default org.');
  });

  it('propagates failure when unsetTargetOrg fails', async () => {
    unsetTargetOrgMock = jest.fn().mockReturnValue(Effect.fail({ _tag: 'ConfigWriteError', message: 'write failed' }));
    const exit = await run({ unsetTargetOrg: unsetTargetOrgMock });

    expect(Exit.isFailure(exit)).toBe(true);
    expect(showInformationMessageMock).not.toHaveBeenCalled();
  });
});
