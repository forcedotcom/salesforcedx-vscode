import { ConfigUtil } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { monitorOrgConfigChanges, showOrg } from '../../../src/decorators';

describe('scratch org decorator', () => {
  const mockStatusBarItem = {
    tooltip: '',
    command: '',
    show: jest.fn(),
    text: ''
  };
  const mockWatcher = {
    onDidChange: jest.fn(),
    onDidCreate: jest.fn(),
    onDidDelete: jest.fn()
  };
  let mockFileSystemWatcher: jest.SpyInstance;

  beforeEach(() => {
    (vscode.window.createStatusBarItem as any).mockReturnValue(
      mockStatusBarItem
    );
    mockFileSystemWatcher = (vscode.workspace
      .createFileSystemWatcher as any).mockReturnValue(mockWatcher);
  });

  it('should not show the browser icon in the status bar when a default username is not set', async () => {
    // Act
    await showOrg();
    expect(mockStatusBarItem.text).toEqual('');
  });
  it('should show the browser icon in the status bar when a default username is set', async () => {
    jest
      .spyOn(ConfigUtil, 'getDefaultUsernameOrAlias')
      .mockResolvedValue('test@username.com');
    // Act
    await showOrg();
    expect(mockStatusBarItem.text).toEqual(`$(browser)`);
  });

  it('should show the browser icon when the config file changes', () => {
    // Act
    monitorOrgConfigChanges();
    expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalled();
    expect(mockWatcher.onDidChange).toHaveBeenCalledWith(expect.any(Function));
    expect(mockWatcher.onDidCreate).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should show the browser icon when the config file is created', () => {});
});
