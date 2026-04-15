/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'node:path';
import { WorkspaceContextUtil } from '../../../../src/context/workspaceContextUtil';
import { SourceTrackingProvider } from '../../../../src/providers/sourceTrackingProvider';
import { SourceTrackingService } from '../../../../src/services/sourceTrackingService';
import { testData } from './testData';

jest.mock('@salesforce/core', () => ({
  ...jest.requireActual('@salesforce/core'),
  Org: { create: jest.fn() },
  SfProject: { resolve: jest.fn() }
}));

jest.mock('../../../../src/providers/sourceTrackingProvider');

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

  describe('updateSourceTrackingAfterDeploy', () => {
    const updateTrackingFromDeploySpy = jest.fn();
    const dummySourceTracking = {
      updateTrackingFromDeploy: updateTrackingFromDeploySpy
    } as any;

    it('Should update an instance of SourceTracking using the deploy result', async () => {
      const dummyDeployResult = {} as any;
      await SourceTrackingService.updateSourceTrackingAfterDeploy(dummySourceTracking, dummyDeployResult);

      expect(updateTrackingFromDeploySpy).toHaveBeenCalledWith(dummyDeployResult);
    });
  });

  describe('getSourceStatusSummary', () => {
    const mockWorkspaceContextUtil = {
      onOrgChange: jest.fn(),
      getConnection: jest.fn()
    };
    const getStatusMock = jest.fn();
    const mockSourceTracking = {
      getStatus: getStatusMock
    };
    const mockSourceTrackingProvider = {
      getSourceTracker: jest.fn()
    };

    let getSourceTrackerMock: jest.SpyInstance;

    beforeEach(() => {
      jest.spyOn(WorkspaceContextUtil, 'getInstance').mockReturnValue(mockWorkspaceContextUtil as any);
      jest.spyOn(SourceTrackingProvider, 'getInstance').mockReturnValue(mockSourceTrackingProvider as any);

      getSourceTrackerMock = jest
        .spyOn(mockSourceTrackingProvider, 'getSourceTracker')
        .mockResolvedValue(mockSourceTracking as any);
    });

    it('Should return a properly formatted string when changes exist in the response', async () => {
      // Arrange
      getStatusMock.mockResolvedValue(testData.statusResponse as any);

      // Act
      const formattedOutput: string = await SourceTrackingService.getSourceStatusSummary({});

      // Assert
      expect(getSourceTrackerMock).toHaveBeenCalled();
      expect(getStatusMock).toHaveBeenCalled();
      expect(formattedOutput).toMatchSnapshot();
    });

    it('Should return a friendly message when no changes exist', async () => {
      // Arrange
      getStatusMock.mockResolvedValue(testData.noChangesResponse as any);

      // Act
      const formattedOutput: string = await SourceTrackingService.getSourceStatusSummary({});

      // Assert
      expect(getSourceTrackerMock).toHaveBeenCalled();
      expect(getStatusMock).toHaveBeenCalled();
      expect(formattedOutput).toMatchSnapshot();
    });
  });

  describe('clearSourceTracking', () => {
    const mockConnection = {
      getUsername: jest.fn().mockReturnValue('test@example.com')
    } as any;
    const mockSourceTracking = {
      updateTrackingFromRetrieve: jest.fn(),
      updateTrackingFromDeploy: jest.fn(),
      getStatus: jest.fn(),
      localChangesAsComponentSet: jest.fn(),
      ensureRemoteTracking: jest.fn(),
      maybeApplyRemoteDeletesToLocal: jest.fn()
    } as any;
    const mockProvider: SourceTrackingProvider = {
      getSourceTracker: jest.fn().mockResolvedValue(mockSourceTracking),
      clearSourceTracker: jest.fn()
    } as any;

    beforeEach(() => {
      (SourceTrackingProvider.getInstance as jest.Mock).mockReturnValue(mockProvider);
    });

    it('should call clearSourceTracker on the provider with valid parameters', () => {
      const projectPath = path.join('test', 'project', 'path');

      SourceTrackingService.clearSourceTracking(projectPath, mockConnection);

      expect(SourceTrackingProvider.getInstance).toHaveBeenCalled();
      expect(mockProvider.clearSourceTracker).toHaveBeenCalledWith(projectPath, mockConnection);
    });
  });
});
