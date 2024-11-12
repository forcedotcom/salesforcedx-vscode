/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { projectPaths } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { registerIsvAuthWatcher } from '../../../src/context';

describe('isvContext unit test', () => {
  describe('registerIsvAuthWatcher', () => {
    const fakePath = '/here/is/a/fake/config.json';
    let extensionContext: any;
    let salesforceProjectConfigStub: jest.SpyInstance;
    let pushSpy: jest.SpyInstance;
    let onDidChangeSpy: jest.SpyInstance;
    let onDidCreateSpy: jest.SpyInstance;
    let onDidDeleteSpy: jest.SpyInstance;

    beforeEach(() => {
      salesforceProjectConfigStub = jest.spyOn(projectPaths, 'salesforceProjectConfig').mockReturnValue(fakePath);
      onDidChangeSpy = jest.fn();
      onDidCreateSpy = jest.fn();
      onDidDeleteSpy = jest.fn();
      // explicitly set this return value due to the VS Code mock not being reset
      (vscode.workspace.createFileSystemWatcher as any).mockReturnValue({
        onDidChange: onDidChangeSpy,
        onDidCreate: onDidCreateSpy,
        onDidDelete: onDidDeleteSpy
      });
      pushSpy = jest.fn();
      extensionContext = {
        subscriptions: {
          push: pushSpy
        }
      };
    });

    it('should be defined', () => {
      expect(registerIsvAuthWatcher).toBeDefined();
    });

    it('should not watch files if workspace folders are not present', () => {
      registerIsvAuthWatcher(extensionContext);
      expect(vscode.workspace.createFileSystemWatcher).not.toHaveBeenCalled();
    });

    it('should watch files if workspace folders are present', () => {
      (vscode.workspace.workspaceFolders as any) = ['1'];
      registerIsvAuthWatcher(extensionContext);
      expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledWith(fakePath);
      expect(onDidChangeSpy).toHaveBeenCalledWith(expect.any(Function));
      expect(onDidCreateSpy).toHaveBeenCalledWith(expect.any(Function));
      expect(onDidDeleteSpy).toHaveBeenCalledWith(expect.any(Function));
      expect(pushSpy).toHaveBeenCalled();
    });
  });
});
