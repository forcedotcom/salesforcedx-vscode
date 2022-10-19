import { projectPaths } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { registerIsvAuthWatcher } from '../../../src/context';

describe('isvContext unit test', () => {

  describe('registerIsvAuthWatcher', () => {
    const fakePath = '/here/is/a/fake/sfdx-config.json';
    let extensionContext: any;
    let sfdxProjectConfigStub: jest.SpyInstance;
    let createFileSystemWatcherStub: jest.SpyInstance;
    let extensionContextSpy: jest.SpyInstance;

    beforeEach(() => {
      extensionContext = {
        subscriptions: {
          push: jest.fn()
        }
      };
      jest.restoreAllMocks();
    });

    it('registerIsvAuthWatcher is defined', () => {
      expect(registerIsvAuthWatcher).toBeDefined();
    });

    it('Should not watch files if workspace folders are not present', () => {
      createFileSystemWatcherStub = jest.spyOn(vscode.workspace, 'createFileSystemWatcher');
      registerIsvAuthWatcher(extensionContext);
      expect(vscode.workspace.createFileSystemWatcher).not.toHaveBeenCalled();
    });

    it('Should watch files if workspace folders are present', () => {
      (vscode.workspace.workspaceFolders as any) = ['1'];
      sfdxProjectConfigStub = jest.spyOn(projectPaths, 'sfdxProjectConfig').mockReturnValue(fakePath);
      createFileSystemWatcherStub = jest.spyOn(vscode.workspace, 'createFileSystemWatcher');
      extensionContextSpy = jest.spyOn(extensionContext.subscriptions, 'push');
      registerIsvAuthWatcher(extensionContext);
      expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalled();
      expect(extensionContextSpy).toHaveBeenCalled();
    });
  });
});
