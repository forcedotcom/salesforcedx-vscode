/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { MetadataCacheService } from '../../../src/conflict';
import * as diffUtils from '../../../src/conflict/componentDiffer';
import { PersistentStorageService } from './../../../src/conflict/persistentStorageService';
import { TimestampConflictDetector } from './../../../src/conflict/timestampConflictDetector';
import { dummyLastModifiedDateLocal, testData } from './data/testData';

describe('TimestampConflictDetector', () => {
  let persistentStorageServiceMock: jest.SpyInstance;
  let correlateResultsStub: jest.SpyInstance;
  let diffComponentsStub: jest.SpyInstance;

  describe('createDiffs', () => {
    beforeEach(() => {
      correlateResultsStub = jest
        .spyOn(MetadataCacheService, 'correlateResults')
        .mockReturnValue(testData.dummyCorrelatedComponents as any);
      persistentStorageServiceMock = jest.spyOn(PersistentStorageService, 'getInstance').mockReturnValue({
        makeKey: jest.fn(),
        getPropertiesForFile: jest.fn().mockResolvedValueOnce({
          // For the first file, give a value that will trip the
          // conflict checker
          lastModifiedDate: dummyLastModifiedDateLocal
        })
      } as any);
    });

    it('should return diff results for only the files that trip the timestamp conflict detector', async () => {
      // Only return a diff for the first file, which should have tripped the timestamp check
      diffComponentsStub = jest
        .spyOn(diffUtils, 'diffComponents')
        .mockReturnValueOnce(testData.dummyDiffs)
        .mockReturnValueOnce([]);
      const timestampConflictDetector = new TimestampConflictDetector();

      const diffs = timestampConflictDetector.createDiffs(testData.dummyMetadataCacheResult as any);

      expect(correlateResultsStub).toHaveBeenCalledWith(testData.dummyMetadataCacheResult);
      expect(persistentStorageServiceMock).toHaveBeenCalled();
      expect(diffComponentsStub).toHaveBeenCalledTimes(2);
      expect(diffs.different.size).toBe(2);
    });
  });
});
