/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ConfigUtil } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { ORG_OPEN_COMMAND } from '../../../src/constants';
import { decorators } from '../../../src/decorators';
import { nls } from '../../../src/messages';

describe('scratch org decorator', () => {
  const testUser = 'test@username.com';
  const browserIcon = '$(browser)';
  const openOrgCommand = ORG_OPEN_COMMAND;
  let createFileSystemWatcherMock: jest.SpyInstance;
  let getTargetOrgOrAliasMock: jest.SpyInstance;
  let createStatusBarItemMock: jest.SpyInstance;
  const mockStatusBarItem: any = {};
  let mockWatcher: any;

  beforeEach(() => {
    mockStatusBarItem.tooltip = '';
    mockStatusBarItem.command = '';
    mockStatusBarItem.text = '';
    mockStatusBarItem.show = jest.fn();
    mockStatusBarItem.dispose = jest.fn();
    mockWatcher = {
      onDidChange: jest.fn(),
      onDidCreate: jest.fn()
    };
    createStatusBarItemMock = (vscode.window.createStatusBarItem as any).mockReturnValue(mockStatusBarItem);
    createFileSystemWatcherMock = (vscode.workspace.createFileSystemWatcher as any).mockReturnValue(mockWatcher);
    getTargetOrgOrAliasMock = jest.spyOn(ConfigUtil, 'getTargetOrgOrAlias');
  });

  describe('show Org', () => {
    it('should show the browser icon in the status bar when a target org is set', async () => {
      getTargetOrgOrAliasMock.mockResolvedValue(testUser);
      await decorators.showOrg();
      expect(getTargetOrgOrAliasMock).toHaveBeenCalled();
      expect(createStatusBarItemMock).toHaveBeenCalled();
      expect(mockStatusBarItem.tooltip).toEqual(nls.localize('status_bar_open_org_tooltip'));
      expect(mockStatusBarItem.command).toEqual(openOrgCommand);
      expect(mockStatusBarItem.show).toHaveBeenCalled();
      expect(mockStatusBarItem.text).toEqual(browserIcon);
    });
    it('should not show the browser icon in the status bar when a target org is not set', async () => {
      await decorators.showOrg();
      expect(getTargetOrgOrAliasMock).toHaveBeenCalled();
      expect(createStatusBarItemMock).not.toHaveBeenCalled();
      expect(mockStatusBarItem.tooltip).toEqual('');
      expect(mockStatusBarItem.command).toEqual('');
      expect(mockStatusBarItem.show).not.toHaveBeenCalled();
      expect(mockStatusBarItem.text).toEqual('');
    });
    it('should dispose and set to undefined the status bar when a target org is not set and the status bar exists', async () => {
      getTargetOrgOrAliasMock.mockResolvedValue(testUser);
      await decorators.showOrg();
      expect(getTargetOrgOrAliasMock).toHaveBeenCalled();
      expect(createStatusBarItemMock).toHaveBeenCalled();

      getTargetOrgOrAliasMock.mockResolvedValue(undefined);
      await decorators.showOrg();
      expect(getTargetOrgOrAliasMock).toHaveBeenCalledTimes(2);
      expect(createStatusBarItemMock).toHaveBeenCalledTimes(1);
      expect(mockStatusBarItem.dispose).toHaveBeenCalled();
    });
  });
});
