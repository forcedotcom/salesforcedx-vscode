import { ConfigUtil } from '@salesforce/salesforcedx-utils-vscode';
import { mock } from 'sinon';
import * as vscode from 'vscode';
import URI from 'vscode-uri';
import { monitorOrgConfigChanges, showOrg } from '../../../src/decorators';
import { nls } from '../../../src/messages';

describe('scratch org decorator', () => {
  const testUser = 'test@username.com';
  const browserIcon = `$(browser)`;
  const openOrgCommand = 'sfdx.force.org.open';
  const fakePathURI = URI.file('/Users/tester/mockNewFile.test.js');
  const mockStatusBarItem = {
    tooltip: '',
    command: '',
    show: jest.fn(),
    text: ''
  };
  let onDidCreateEventEmitter: vscode.EventEmitter<vscode.Uri>;
  let onDidChangeEventEmitter: vscode.EventEmitter<vscode.Uri>;
  onDidCreateEventEmitter = new vscode.EventEmitter<vscode.Uri>();
  onDidChangeEventEmitter = new vscode.EventEmitter<vscode.Uri>();
  const mockWatcher = {
    // onDidChange: onDidChangeEventEmitter.event,
    // onDidCreate: onDidCreateEventEmitter.event
    onDidChange: jest.fn(),
    onDidCreate: jest.fn()
  };
  let mockFileSystemWatcher: jest.SpyInstance;
  let mockGetDefaultUsername: jest.SpyInstance;
  let mockCreateStatusBar: jest.SpyInstance;

  beforeEach(() => {
    mockCreateStatusBar = (vscode.window.createStatusBarItem as any).mockReturnValue(
      mockStatusBarItem
    );
    mockFileSystemWatcher = (vscode.workspace
      .createFileSystemWatcher as any).mockReturnValue(mockWatcher);
    mockGetDefaultUsername = jest
      .spyOn(ConfigUtil, 'getDefaultUsernameOrAlias');
  });

  describe('show Org', () => {
    it('should not show the browser icon in the status bar when a default username is not set', async () => {
      await showOrg();
      expect(mockCreateStatusBar).toHaveBeenCalled();
      expect(mockStatusBarItem.text).toEqual('');
      expect(mockStatusBarItem.tooltip).toEqual(nls.localize('status_bar_open_org_tooltip'));
      expect(mockStatusBarItem.command).toEqual(openOrgCommand);
      expect(mockStatusBarItem.show).toHaveBeenCalled();
      expect(mockGetDefaultUsername).toHaveBeenCalled();
    });
    it('should show the browser icon in the status bar when a default username is set', async () => {
      mockGetDefaultUsername.mockResolvedValue(testUser);
      await showOrg();
      expect(mockStatusBarItem.text).toEqual(browserIcon);
      expect(mockStatusBarItem.show).toHaveBeenCalledTimes(0);
      expect(mockGetDefaultUsername).toHaveBeenCalled();
    });

  });

  describe('monitor org changes', () => {
    it('should show the browser icon when the config file changes', () => {
      onDidChangeEventEmitter.fire(fakePathURI);
      // Act
      monitorOrgConfigChanges();
      expect(mockFileSystemWatcher).toHaveBeenCalled();
      expect(mockWatcher.onDidChange).toHaveBeenCalledWith(expect.any(Function));
      // expect(mockGetDefaultUsername).toHaveBeenCalled();
    });

    it('should show the browser icon when the config file is created', () => {
      monitorOrgConfigChanges();
      expect(mockFileSystemWatcher).toHaveBeenCalled();
      expect(mockWatcher.onDidCreate).toHaveBeenCalledWith(expect.any(Function));
      // expect(mockGetDefaultUsername).toHaveBeenCalled();
    });
  });
});
