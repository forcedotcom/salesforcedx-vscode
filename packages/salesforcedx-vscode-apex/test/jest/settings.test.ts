/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { SettingsService } from 'salesforcedx-vscode-services/src/vscode/settingsService';
import { retrieveAAMethodAnnotations, retrieveEnableSyncInitJobs } from '../../src/settings';

describe('settings Unit Tests.', () => {
  const getValue = jest.fn();
  const settingsService = SettingsService.make({ getValue, getValueOrElse: getValue } as never);
  const run = <A, E>(effect: Effect.Effect<A, E, ExtensionProviderService | SettingsService>) =>
    Effect.runPromise(
      effect.pipe(
        Effect.provideService(ExtensionProviderService, {
          getServicesApi: Effect.succeed({
            services: { SettingsService }
          } as never)
        }),
        Effect.provideService(SettingsService, settingsService)
      )
    );

  beforeEach(() => {
    getValue.mockReset();
  });

  it('Should be able to get retrieveEnableSyncInitJobs setting.', async () => {
    getValue.mockReturnValue(Effect.succeed(true));

    const result = await run(retrieveEnableSyncInitJobs());
    expect(result).toBe(true);
    expect(getValue).toHaveBeenCalledWith('salesforcedx-vscode-apex', 'wait-init-jobs', true);
  });

  it('Should be able to get retrieveAAMethodAnnotations setting.', async () => {
    getValue.mockReturnValue(Effect.succeed(['AuraEnabled', 'UserDefinedModifier', 'UserDefinedModifier']));

    const result = await run(retrieveAAMethodAnnotations());
    expect(result).toHaveLength(2);
    expect(result).toEqual(expect.arrayContaining(['AuraEnabled', 'UserDefinedModifier']));
    expect(getValue).toHaveBeenCalledWith('salesforcedx-vscode-apex', 'apexoas.aa.method.annotations', []);
  });
});
