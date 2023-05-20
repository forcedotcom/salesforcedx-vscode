/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ForceSourcePushExecutor } from '../../../src/commands';
import { PersistentStorageService } from '../../../src/conflict';
import { dummyPushResult } from './data/testData';

describe('ForceSourcePushExecutor', () => {
  describe('updateCache', () => {
    const setPropertiesForFilesPushPullMock = jest.fn();

    beforeEach(() => {
      jest.spyOn(PersistentStorageService, 'getInstance').mockReturnValue({
        setPropertiesForFilesPushPull: setPropertiesForFilesPushPullMock
      } as any);
    });

    it('should update the local cache for the pulled source components after push', async () => {
      const p = new ForceSourcePushExecutor();

      (p as any).updateCache(dummyPushResult);

      expect(setPropertiesForFilesPushPullMock).toHaveBeenCalledWith(
        dummyPushResult.result.pushedSource
      );
    });
  });
});
