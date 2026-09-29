/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { SettingsService } from 'salesforcedx-vscode-services/src/vscode/settingsService';
import { isConflictDetectionEnabled } from '../../../src/conflict/conflictDetectionSettings';

describe('conflictDetectionSettings', () => {
  const getValueOrElse = jest.fn();
  const settingsService = SettingsService.make({ getValueOrElse } as never);
  const run = () =>
    Effect.runPromise(
      isConflictDetectionEnabled().pipe(
        Effect.provideService(ExtensionProviderService, {
          getServicesApi: Effect.succeed({
            services: { SettingsService }
          } as never)
        }),
        Effect.provideService(SettingsService, settingsService)
      )
    );

  beforeEach(() => {
    getValueOrElse.mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isConflictDetectionEnabled', () => {
    it('returns true when the setting is true', async () => {
      getValueOrElse.mockReturnValue(Effect.succeed(true));

      const result = await run();

      expect(result).toBe(true);
      expect(getValueOrElse).toHaveBeenCalledWith(
        'salesforcedx-vscode-metadata',
        'sourceTracking.enableConflictDetection',
        true
      );
    });

    it('returns false when the setting is false', async () => {
      getValueOrElse.mockReturnValue(Effect.succeed(false));

      const result = await run();

      expect(result).toBe(false);
      expect(getValueOrElse).toHaveBeenCalledWith(
        'salesforcedx-vscode-metadata',
        'sourceTracking.enableConflictDetection',
        true
      );
    });
  });
});
