/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SourceTracking } from '@salesforce/source-tracking';
import { WorkspaceContextUtil } from '../../../../src';
import { SourceTrackingService } from '../../../../src/services';
import { testData } from './testData';

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

  describe('getSourceStatusSummary', () => {
    const mockWorkspaceContextUtil = {
      onOrgChange: jest.fn(),
      getConnection: jest.fn()
    };
    const updateTrackingFromRetrieveSpy = jest.fn();
    const getStatusMock = jest.fn();
    const dummySourceTracking = {
      updateTrackingFromRetrieve: updateTrackingFromRetrieveSpy
    } as any;

    let workspaceContextUtilGetInstanceSpy: jest.SpyInstance;
    let sourceTrackingMock: jest.SpyInstance;

    beforeEach(() => {
      workspaceContextUtilGetInstanceSpy = jest
        .spyOn(WorkspaceContextUtil, 'getInstance')
        .mockReturnValue(mockWorkspaceContextUtil as any);

      sourceTrackingMock = jest
        .spyOn(SourceTracking, 'create')
        .mockResolvedValue({
          getStatus: getStatusMock
        } as any);
    });

    it('Should return a properly formatted string when changes exist in the response', async () => {
      getStatusMock.mockResolvedValue(testData.statusResponse as any);

      // Act
      const formattedOutput: string = await SourceTrackingService.getSourceStatusSummary(
        {}
      );

      // Assert
      expect(workspaceContextUtilGetInstanceSpy).toHaveBeenCalled();
      expect(sourceTrackingMock).toHaveBeenCalled();
      expect(formattedOutput).toMatchSnapshot();
    });

    // it('Should return a properly formatted string when remote changes exist and one file is ignored.', async () => {
    //   getStatusMock.mockResolvedValue(testData.remoteAndIgnoredResponse as any);

    //   // Act
    //   const formattedOutput: string = await SourceTrackingService.getSourceStatusSummary(
    //     {}
    //   );

    //   // Assert
    //   expect(workspaceContextUtilGetInstanceSpy).toHaveBeenCalled();
    //   expect(sourceTrackingMock).toHaveBeenCalled();
    //   expect(formattedOutput).toEqual(testData.remoteAndIgnoredSummary);
    // });
  });
});
