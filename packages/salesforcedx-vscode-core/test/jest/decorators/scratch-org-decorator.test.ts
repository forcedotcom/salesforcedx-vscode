import { ConfigUtil } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { ORG_OPEN_COMMAND } from '../../../src';
import { monitorOrgConfigChanges, showOrg } from '../../../src/decorators';
import { nls } from '../../../src/messages';

describe('scratch org decorator', () => {
  const testUser = 'test@username.com';
  const browserIcon = `$(browser)`;
  const openOrgCommand = ORG_OPEN_COMMAND;
  let createFileSystemWatcherMock: jest.SpyInstance;
  let getDefaultUsernameOrAliasMock: jest.SpyInstance;
  let createStatusBarItemMock: jest.SpyInstance;
  const mockStatusBarItem: any = {};
  let mockWatcher: any;

  beforeEach(() => {
    mockStatusBarItem.tooltip = '';
    mockStatusBarItem.command = '';
    mockStatusBarItem.text = '';
    mockStatusBarItem.show = jest.fn();
    mockWatcher = {
      onDidChange: jest.fn(),
      onDidCreate: jest.fn()
    };
    createStatusBarItemMock = (vscode.window.createStatusBarItem as any).mockReturnValue(
      mockStatusBarItem
    );
    createFileSystemWatcherMock = (vscode.workspace
      .createFileSystemWatcher as any).mockReturnValue(mockWatcher);
    getDefaultUsernameOrAliasMock = jest
      .spyOn(ConfigUtil, 'getDefaultUsernameOrAlias');
  });

  describe('show Org', () => {
    it('should show the browser icon in the status bar when a default username is set', async () => {
      getDefaultUsernameOrAliasMock.mockResolvedValue(testUser);
      await showOrg();
      expect(getDefaultUsernameOrAliasMock).toHaveBeenCalled();
      expect(createStatusBarItemMock).toHaveBeenCalled();
      expect(mockStatusBarItem.tooltip).toEqual(nls.localize('status_bar_open_org_tooltip'));
      expect(mockStatusBarItem.command).toEqual(openOrgCommand);
      expect(mockStatusBarItem.show).toHaveBeenCalled();
      expect(mockStatusBarItem.text).toEqual(browserIcon);
    });
    it('should not show the browser icon in the status bar when a default username is not set', async () => {
      await showOrg();
      expect(getDefaultUsernameOrAliasMock).toHaveBeenCalled();
      expect(createStatusBarItemMock).not.toHaveBeenCalled();
      expect(mockStatusBarItem.tooltip).toEqual('');
      expect(mockStatusBarItem.command).toEqual('');
      expect(mockStatusBarItem.show).not.toHaveBeenCalled();
      expect(mockStatusBarItem.text).toEqual('');
    });

  });

  describe('monitor org changes', () => {
    it('should show the browser icon when the config file changes', async () => {
      getDefaultUsernameOrAliasMock.mockResolvedValue(testUser);

      // Act
      monitorOrgConfigChanges();
      // Expect a file system watcher was created
      expect(createFileSystemWatcherMock).toHaveBeenCalled();
      // Expect a callback was supplied for its onDidChange fn
      expect(mockWatcher.onDidChange).toHaveBeenCalledWith(expect.any(Function));

      // Act again and call the onDidChange callback fn
      mockWatcher.onDidChange.mock.calls[0][0]();
      // Resolve the promise, since it is not awaited in the module itself
      await new Promise(process.nextTick);

      // The module should check if there is a default username or alias
      expect(getDefaultUsernameOrAliasMock).toHaveBeenCalled();
      // Browser icon should be displayed
      expect(mockStatusBarItem.text).toEqual(browserIcon);
    });

    it('should show the browser icon when the config file is created', async () => {
      getDefaultUsernameOrAliasMock.mockResolvedValue(testUser);

      // Act
      monitorOrgConfigChanges();
      // Expect a file system watcher was created
      expect(createFileSystemWatcherMock).toHaveBeenCalled();
      // Expect a callback was supplied for its onDidCreate fn
      expect(mockWatcher.onDidCreate).toHaveBeenCalledWith(expect.any(Function));

      // Act again and call the onDidCreate callback fn
      mockWatcher.onDidCreate.mock.calls[0][0]();
      // Resolve the promise, since it is not awaited in the module itself
      await new Promise(process.nextTick);

      // The module should check if there is a default username or alias
      expect(getDefaultUsernameOrAliasMock).toHaveBeenCalled();
      // Browser icon should be displayed
      expect(mockStatusBarItem.text).toEqual(browserIcon);
    });
  });
});
