/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ConfigUtil } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { setIsScratchOrg } from '../../../src/context/contextVariables';
import { OrgAuthInfo } from '../../../src/util';

describe('contextVariables', () => {
  describe('setIsScratchOrg', () => {
    let getUsernameMock: jest.SpyInstance;
    let isAScratchOrgMock: jest.SpyInstance;
    let executeCommandSpy: jest.SpyInstance;

    beforeEach(() => {
      getUsernameMock = jest
        .spyOn(ConfigUtil, 'getUsername')
        .mockResolvedValue('test@test.com');

      isAScratchOrgMock = jest.spyOn(OrgAuthInfo, 'isAScratchOrg');

      executeCommandSpy = jest.spyOn(vscode.commands, 'executeCommand');
    });

    it('should set the sfdx:is_scratch_org context variable to false when not connected to a scratch org', async () => {
      isAScratchOrgMock.mockResolvedValue(false);

      await setIsScratchOrg();

      expect(getUsernameMock).toHaveBeenCalled();
      expect(isAScratchOrgMock).toHaveBeenCalled();
      expect(executeCommandSpy).toHaveBeenCalledWith(
        'setContext',
        'sfdx:is_scratch_org',
        false
      );
    });

    it('should set the sfdx:is_scratch_org context variable to true when connected to a scratch org', async () => {
      isAScratchOrgMock.mockResolvedValue(true);

      await setIsScratchOrg();

      expect(getUsernameMock).toHaveBeenCalled();
      expect(isAScratchOrgMock).toHaveBeenCalled();
      expect(executeCommandSpy).toHaveBeenCalledWith(
        'setContext',
        'sfdx:is_scratch_org',
        true
      );
    });
  });
});
