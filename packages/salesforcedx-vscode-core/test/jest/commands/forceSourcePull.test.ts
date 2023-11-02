/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ForceSourcePullExecutor } from '../../../src/commands/forceSourcePull';
import { PersistentStorageService } from '../../../src/conflict';
import { dummyPullResult } from './data/testData';

describe('ForceSourcePullExecutor', () => {
  describe('updateCache', () => {
    const setPropertiesForFilesPushPullMock = jest.fn();

    beforeEach(() => {
      jest.spyOn(PersistentStorageService, 'getInstance').mockReturnValue({
        setPropertiesForFilesPushPull: setPropertiesForFilesPushPullMock
      } as any);
    });

    it('should update the local cache for the pulled source components after pull', async () => {
      const pullExecutor = new ForceSourcePullExecutor();

      (pullExecutor as any).updateCache(dummyPullResult);

      expect(setPropertiesForFilesPushPullMock).toHaveBeenCalledWith(
        dummyPullResult.result.pulledSource
      );
    });
  });
});
