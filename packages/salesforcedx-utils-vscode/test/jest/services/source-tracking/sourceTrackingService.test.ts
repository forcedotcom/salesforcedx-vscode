/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SourceTracking, StatusOutputRow } from '@salesforce/source-tracking';
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
      // Arrange
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

    it('Should return a friendly message when no changes exist', async () => {
      getStatusMock.mockResolvedValue(testData.noChangesResponse as any);

      const formattedOutput: string = await SourceTrackingService.getSourceStatusSummary(
        {}
      );

      expect(workspaceContextUtilGetInstanceSpy).toHaveBeenCalled();
      expect(sourceTrackingMock).toHaveBeenCalled();
      expect(formattedOutput).toMatchSnapshot();
    });
  });

  describe('get local and remote Source Status', () => {
    const getStatusMock = jest.spyOn(SourceTracking.prototype, 'getStatus');
    const dummyStatus: any[] | Promise<StatusOutputRow[]> = [];
    const mockWorkspaceContextUtil = {
      onOrgChange: jest.fn(),
      getConnection: jest.fn()
    };
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

      getStatusMock.mockResolvedValue(dummyStatus);
    });

    describe('getLocalStatus', () => {
      it('should only get the local status from source tracking', async () => {
        const localOptions = { local: true, remote: false };

        const localStatus = await SourceTrackingService.getLocalStatus();

        expect(getStatusMock).toHaveBeenCalledWith(localOptions);
        expect(localStatus).toEqual(dummyStatus);
      });
    });

    describe('getRemoteStatus', () => {
      it('should only get the remote status from source tracking', async () => {
        const remoteOptions = { local: false, remote: true };

        const remoteStatus = await SourceTrackingService.getRemoteStatus();

        expect(getStatusMock).toHaveBeenCalledWith(remoteOptions);
        expect(remoteStatus).toEqual(dummyStatus);
      });
    });
  });
});
