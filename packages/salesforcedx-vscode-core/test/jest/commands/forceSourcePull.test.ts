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
