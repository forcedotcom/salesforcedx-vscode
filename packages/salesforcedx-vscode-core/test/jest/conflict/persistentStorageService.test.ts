/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { WorkspaceContextUtil } from '@salesforce/salesforcedx-utils-vscode';
import { RequestStatus } from '@salesforce/source-deploy-retrieve-bundle';
import { PersistentStorageService } from '../../../src/conflict';
import { MockExtensionContext } from './mockExtensionContext';

describe('PersistentStorageService', () => {
  const mockWorkspaceContextUtil = {
    onOrgChange: jest.fn(),
    getConnection: jest.fn()
  };
  describe('setPropertiesForFilesRetrieve', () => {
    let setPropertiesForFileMock: jest.SpyInstance;

    beforeEach(() => {
      jest.spyOn(WorkspaceContextUtil, 'getInstance').mockReturnValue(mockWorkspaceContextUtil as any);

      const mockExtensionContext = new MockExtensionContext();
      PersistentStorageService.initialize(mockExtensionContext);
      setPropertiesForFileMock = jest.spyOn(PersistentStorageService.prototype, 'setPropertiesForFile');
    });

    it('should update the properties in the cache for the files that are passed in', () => {
      const cache = PersistentStorageService.getInstance();

      cache.setPropertiesForFilesRetrieve([
        { type: 'ApexClass', fullName: 'TestClassOne' } as any,
        { type: 'ApexClass', fullName: 'TestClassTwo' } as any
      ]);

      expect(setPropertiesForFileMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('setPropertiesForFilesDeploy', () => {
    let setPropertiesForFileMock: jest.SpyInstance;

    beforeEach(() => {
      jest.spyOn(WorkspaceContextUtil, 'getInstance').mockReturnValue(mockWorkspaceContextUtil as any);

      const mockExtensionContext = new MockExtensionContext();
      PersistentStorageService.initialize(mockExtensionContext);
      setPropertiesForFileMock = jest.spyOn(PersistentStorageService.prototype, 'setPropertiesForFile');
    });

    it('should update the properties in the cache for the files that are passed in', () => {
      const cache = PersistentStorageService.getInstance();

      cache.setPropertiesForFilesDeploy({
        response: {
          status: RequestStatus.Succeeded,
          checkOnly: false,
          createdBy: 'test@example.com',
          createdByName: 'Test User',
          createdDate: '2023-01-01T00:00:00.000Z',
          details: {},
          done: true,
          id: 'test-id',
          ignoreWarnings: false,
          lastModifiedBy: 'test@example.com',
          lastModifiedByName: 'Test User',
          lastModifiedDate: '2023-01-01T00:00:00.000Z',
          numberComponentErrors: 0,
          numberComponentsDeployed: 2,
          numberComponentsTotal: 2,
          numberTestErrors: 0,
          numberTestsCompleted: 0,
          numberTestsTotal: 0,
          rollbackOnError: true,
          runTestsEnabled: false,
          startDate: '2023-01-01T00:00:00.000Z',
          stateDetail: undefined,
          statusCode: undefined
        },
        replacements: new Map(),
        getFileResponses: jest.fn().mockReturnValue([
          { type: 'ApexClass', fullName: 'TestClassOne' },
          { type: 'ApexClass', fullName: 'TestClassTwo' }
        ])
      } as any);

      expect(setPropertiesForFileMock).toHaveBeenCalledTimes(2);
    });
  });
});
