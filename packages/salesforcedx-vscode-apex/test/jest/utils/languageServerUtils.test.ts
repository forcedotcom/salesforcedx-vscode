/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  extensionUris,
  projectPaths
} from '@salesforce/salesforcedx-utils-vscode';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { VSCODE_APEX_EXTENSION_NAME } from '../../../src/constants';
import { languageServerUtils } from '../../../src/helpers/languageServerUtils';

describe('languageServer Unit Tests.', () => {
  describe('setupDb()', () => {
    const fakeApexDb = '.sfdx/tools/apex.db';
    const fakeExtensionUri = { uri: 'file://here/is/the/extension' };
    const fakeUrl = 'this/is/a/fake/uri';
    const fakeUri = {
      url: fakeUrl,
      toString: () => {
        return fakeUrl;
      }
    };
    let existsSyncSpy: jest.SpyInstance;
    let unlinkSyncSpy: jest.SpyInstance;
    let copyFileSyncSpy: jest.SpyInstance;
    let extensionUriSpy: jest.SpyInstance;
    let joinSpy: jest.SpyInstance;
    let apexLanguageServerDatabaseSpy: jest.SpyInstance;
    let logSpy: jest.SpyInstance;

    beforeEach(() => {
      (vscode.workspace.workspaceFolders as any) = ['totally/valid/workspace'];
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      unlinkSyncSpy = jest.spyOn(fs, 'unlinkSync').mockReturnValue();
      copyFileSyncSpy = jest.spyOn(fs, 'copyFileSync').mockReturnValue();
      extensionUriSpy = jest
        .spyOn(extensionUris, 'extensionUri')
        .mockReturnValue(fakeExtensionUri as any);
      joinSpy = jest
        .spyOn(extensionUris, 'join')
        .mockReturnValue(fakeUri as any);
      apexLanguageServerDatabaseSpy = jest
        .spyOn(projectPaths, 'apexLanguageServerDatabase')
        .mockReturnValue(fakeApexDb);
      logSpy = jest.spyOn(console, 'log');
    });

    it('Should do nothing if there are no workspace folders.', () => {
      (vscode.workspace.workspaceFolders as any) = [];
      languageServerUtils.setupDB();
      expect(existsSyncSpy).not.toHaveBeenCalled();
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('Should unlink existing and create new db.', () => {
      languageServerUtils.setupDB();
      expect(existsSyncSpy).toHaveBeenCalledWith(fakeApexDb);
      expect(unlinkSyncSpy).toHaveBeenCalled();
      expect(apexLanguageServerDatabaseSpy).toHaveBeenCalled();
      expect(extensionUriSpy).toHaveBeenCalledWith(VSCODE_APEX_EXTENSION_NAME);
      expect(joinSpy).toHaveBeenCalled();
      expect(existsSyncSpy).toHaveBeenCalledWith(fakeUrl);
      expect(copyFileSyncSpy).toHaveBeenCalledWith(fakeUrl, fakeApexDb);
    });

    it('Should skip unlink and create new db.', () => {
      existsSyncSpy.mockReturnValueOnce(false).mockReturnValueOnce(true);
      languageServerUtils.setupDB();
      expect(existsSyncSpy).toHaveBeenCalledWith(fakeApexDb);
      expect(unlinkSyncSpy).not.toHaveBeenCalled();
      expect(copyFileSyncSpy).toHaveBeenCalledWith(fakeUrl, fakeApexDb);
    });

    it('Should skip db create if existing.', () => {
      existsSyncSpy.mockReturnValue(false);
      languageServerUtils.setupDB();
      expect(existsSyncSpy).toHaveBeenCalledWith(fakeApexDb);
      expect(copyFileSyncSpy).not.toHaveBeenCalled();
    });

    it('Should log a thrown error.', () => {
      const handyError = new Error('oh no, file gone');
      existsSyncSpy.mockReset();
      existsSyncSpy.mockReturnValue(false);
      extensionUriSpy.mockImplementation(() => {
        throw handyError;
      });
      languageServerUtils.setupDB();
      expect(existsSyncSpy).toHaveBeenCalledTimes(1);
      expect(unlinkSyncSpy).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(handyError);
    });
  });
});
