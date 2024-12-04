/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { WorkspaceContextUtil } from '../../../../src';
import { SourceTrackingService } from '../../../../src/services';
import { testData } from './testData';

jest.mock('@salesforce/core-bundle', () => ({
  ...jest.requireActual('@salesforce/core-bundle'),
  Org: { create: jest.fn() },
  SfProject: { resolve: jest.fn() }
}));

describe('Source Tracking Service', () => {
  describe('updateSourceTrackingAfterRetrieve', () => {
    const updateTrackingFromRetrieveSpy = jest.fn();
    const dummySourceTracking = {
      updateTrackingFromRetrieve: updateTrackingFromRetrieveSpy
    } as any;

    it('Should update an instance of SourceTracking using the retrieve result', async () => {
      const dummyRetrieveResult = {} as any;
      await SourceTrackingService.updateSourceTrackingAfterRetrieve(dummySourceTracking, dummyRetrieveResult);

      expect(updateTrackingFromRetrieveSpy).toHaveBeenCalledWith(dummyRetrieveResult);
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
    let getSourceTrackingForCurrentProjectMock: jest.SpyInstance;

    beforeEach(() => {
      workspaceContextUtilGetInstanceSpy = jest
        .spyOn(WorkspaceContextUtil, 'getInstance')
        .mockReturnValue(mockWorkspaceContextUtil as any);

      getSourceTrackingForCurrentProjectMock = jest
        .spyOn(SourceTrackingService as any, 'getSourceTrackingForCurrentProject')
        .mockResolvedValue({
          getStatus: getStatusMock
        } as any);
    });

    it('Should return a properly formatted string when changes exist in the response', async () => {
      // Arrange
      getStatusMock.mockResolvedValue(testData.statusResponse as any);

      // Act
      const formattedOutput: string = await SourceTrackingService.getSourceStatusSummary({});

      // Assert
      expect(getSourceTrackingForCurrentProjectMock).toHaveBeenCalled();
      expect(getStatusMock).toHaveBeenCalled();
      expect(formattedOutput).toMatchSnapshot();
    });

    it('Should return a friendly message when no changes exist', async () => {
      getStatusMock.mockResolvedValue(testData.noChangesResponse as any);

      const formattedOutput: string = await SourceTrackingService.getSourceStatusSummary({});

      expect(getSourceTrackingForCurrentProjectMock).toHaveBeenCalled();
      expect(getStatusMock).toHaveBeenCalled();
      expect(formattedOutput).toMatchSnapshot();
    });
  });
});
