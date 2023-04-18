/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SourceTracking } from '@salesforce/source-tracking';
import { SourceTrackingService } from '../../../src/services';

jest.mock('@salesforce/core', () => ({
  ...jest.requireActual('@salesforce/core'),
  Org: { create: jest.fn() },
  SfProject: { resolve: jest.fn() }
}));

describe('Source Tracking Service', () => {
  describe('createSourceTracking', () => {
    let sourceTrackingCreateSpy: jest.SpyInstance;
    let ensureLocalTrackingSpy: jest.SpyInstance;

    beforeEach(() => {
      sourceTrackingCreateSpy = jest
        .spyOn(SourceTracking, 'create')
        .mockResolvedValue({} as any);
      ensureLocalTrackingSpy = jest
        .spyOn(SourceTracking.prototype, 'ensureLocalTracking')
        .mockResolvedValue({} as any);
    });

    it('Should create an instance of SourceTracking', async () => {
      await SourceTrackingService.createSourceTracking('', {} as any);

      expect(sourceTrackingCreateSpy).toHaveBeenCalled();
    });
  });

  describe('updateSourceTrackingAfterRetrieve', () => {
    const updateTrackingFromRetrieveSpy = jest.fn();
    const dummySourceTracking = {
      updateTrackingFromRetrieve: updateTrackingFromRetrieveSpy
    } as any;

    it('Should update an instance of SourceTracking using the retrieve result', async () => {
      const dummyRetrieveResult = {} as any;
      await SourceTrackingService.updateSourceTrackingAfterRetrieve(
        dummySourceTracking,
        dummyRetrieveResult
      );

      expect(updateTrackingFromRetrieveSpy).toHaveBeenCalledWith(
        dummyRetrieveResult
      );
    });
  });
});
