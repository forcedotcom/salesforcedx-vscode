/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { SettingsService, type SalesforceVSCodeServicesApiV2 } from '@salesforce/vscode-services/v2';
import { ALL_EXCEPTION_CATCHER_ENABLED, SFDX_CORE_EXTENSION_NAME } from '../../../src/constants';
import { getEnableAllExceptionCatcher } from '../../../src/settings/salesforceCoreSettings';

describe('getEnableAllExceptionCatcher', () => {
  const getValueOrElse = vi.fn();
  const run = () =>
    Effect.runPromise(
      getEnableAllExceptionCatcher().pipe(
        Effect.provideService(ExtensionProviderService, {
          getServicesApi: Effect.succeed({
            v2: { services: { SettingsService } }
          } as unknown as SalesforceVSCodeServicesApiV2)
        } as unknown as ExtensionProviderService['Service']),
        Effect.provideService(SettingsService, SettingsService.of({ getValueOrElse } as never))
      )
    );

  beforeEach(() => {
    getValueOrElse.mockReset();
  });

  it('reads allExceptionCatcherEnabled with default false', async () => {
    getValueOrElse.mockReturnValue(Effect.succeed(false));

    expect(await run()).toBe(false);
    expect(getValueOrElse).toHaveBeenCalledWith(SFDX_CORE_EXTENSION_NAME, ALL_EXCEPTION_CATCHER_ENABLED, false);
  });
});
