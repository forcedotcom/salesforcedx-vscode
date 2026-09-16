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
  const getValue = jest.fn();
  const settingsService = SettingsService.make({ getValue } as never);
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
    getValue.mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isConflictDetectionEnabled (Effect version)', () => {
    it('should return true when setting is false (conflict detection enabled by default)', async () => {
      getValue.mockReturnValue(Effect.succeed(true));

      const result = await run();

      expect(result).toBe(true);
      expect(getValue).toHaveBeenCalledWith(
        'salesforcedx-vscode-metadata',
        'sourceTracking.enableConflictDetection',
        true
      );
    });

    it('should return false when setting is false (conflict detection disabled)', async () => {
      getValue.mockReturnValue(Effect.succeed(false));

      const result = await run();

      expect(result).toBe(false);
      expect(getValue).toHaveBeenCalledWith(
        'salesforcedx-vscode-metadata',
        'sourceTracking.enableConflictDetection',
        true
      );
    });

    it('should return true when setting is undefined (default behavior)', async () => {
      getValue.mockReturnValue(Effect.succeed(undefined));

      const result = await run();

      expect(result).toBe(true);
    });
  });
});
