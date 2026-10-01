/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import { SFDX_CORE_CONFIGURATION_NAME } from '@salesforce/salesforcedx-utils-vscode';
import * as Effect from 'effect/Effect';
import { SettingsService } from 'salesforcedx-vscode-services/src/vscode/settingsService';
import { ALL_EXCEPTION_CATCHER_ENABLED } from '../../../src/constants';
import { getEnableAllExceptionCatcher } from '../../../src/settings/salesforceCoreSettings';

describe('getEnableAllExceptionCatcher', () => {
  const getValueOrElse = jest.fn();
  const run = () =>
    Effect.runPromise(
      getEnableAllExceptionCatcher().pipe(
        Effect.provideService(ExtensionProviderService, {
          getServicesApi: Effect.succeed({
            services: { SettingsService }
          } as never)
        }),
        Effect.provideService(SettingsService, SettingsService.make({ getValueOrElse } as never))
      )
    );

  beforeEach(() => {
    getValueOrElse.mockReset();
  });

  it('reads allExceptionCatcherEnabled with default false', async () => {
    getValueOrElse.mockReturnValue(Effect.succeed(false));

    expect(await run()).toBe(false);
    expect(getValueOrElse).toHaveBeenCalledWith(SFDX_CORE_CONFIGURATION_NAME, ALL_EXCEPTION_CATCHER_ENABLED, false);
  });
});
