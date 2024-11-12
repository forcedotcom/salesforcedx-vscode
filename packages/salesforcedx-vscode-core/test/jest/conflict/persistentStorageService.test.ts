/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { WorkspaceContextUtil } from '@salesforce/salesforcedx-utils-vscode';
import { PersistentStorageService } from '../../../src/conflict';
import { MockExtensionContext } from '../../vscode-integration/telemetry/MockExtensionContext';

describe('PersistentStorageService', () => {
  const mockWorkspaceContextUtil = {
    onOrgChange: jest.fn(),
    getConnection: jest.fn()
  };
  describe('setPropertiesForFilesPushPull', () => {
    let setPropertiesForFileMock: jest.SpyInstance;
    let workspaceContextUtilGetInstanceSpy: jest.SpyInstance;

    beforeEach(() => {
      workspaceContextUtilGetInstanceSpy = jest
        .spyOn(WorkspaceContextUtil, 'getInstance')
        .mockReturnValue(mockWorkspaceContextUtil as any);

      const mockExtensionContext = new MockExtensionContext(false);
      PersistentStorageService.initialize(mockExtensionContext);
      setPropertiesForFileMock = jest.spyOn(PersistentStorageService.prototype, 'setPropertiesForFile');
    });

    it('should update the properties in the cache for the files that are passed in', () => {
      const cache = PersistentStorageService.getInstance();

      cache.setPropertiesForFilesPushPull([
        { type: 'ApexClass', fullName: 'TestClassOne' } as any,
        { type: 'ApexClass', fullName: 'TestClassTwo' } as any
      ]);

      expect(setPropertiesForFileMock).toHaveBeenCalledTimes(2);
    });
  });
});
