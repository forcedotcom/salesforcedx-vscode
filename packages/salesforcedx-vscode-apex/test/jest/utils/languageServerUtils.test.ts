import * as fs from 'fs';
import * as vscode from 'vscode';

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

import { channelService } from '../../../src/channels';
import { VSCODE_APEX_EXTENSION_NAME } from '../../../src/constants';
import { languageServerUtils } from '../../../src/helpers/languageServerUtils';

describe('languageServer Unit Tests.', () => {
  describe('setupDb()', () => {
    const fakeApexDb = '.sfdx/tools/apex.db';
    const fakeExtensionUri = { path: 'file:///here/is/the/extension' };
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
    let channelSpy: jest.SpyInstance;

    beforeEach(() => {
      (vscode.workspace.workspaceFolders as any) = ['totally/valid/workspace'];
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      unlinkSyncSpy = jest.spyOn(fs, 'unlinkSync').mockReturnValue();
      copyFileSyncSpy = jest.spyOn(fs, 'copyFileSync').mockReturnValue();
      channelSpy = jest.spyOn(channelService, 'appendLine').mockReturnValue();
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

    // testing languageServerUtils.setupDB() with these use cases:
    // 1. no workspace folders
    // 2. should throw an excpetion if the db in extensionUri/resources/apex.db does not exist
    // 3. should copy the db in extensionUri/resources/apex.db to ./sfdx/tools/bundled.apex.db.createDate file ./sfdx/tools/bundled.apex.db.createDate does not exist
    // 4. should copy the db in extensionUri/resources/apex.db to ./sfdx/tools/bundled.apex.db.createDate when the create date of the db in extensionUri/resources/apex.db is newer than the reference date stored in ./sfdx/tools/bundled.apex.db.createDate
    // 5. should not copy the db in extensionUri/resources/apex.db to ./sfdx/tools/bundled.apex.db.createDate when the create date of the db in extensionUri/resources/apex.db is older than the reference date stored in ./sfdx/tools/bundled.apex.db.createDate

    it('Should do nothing if there are no workspace folders.', async () => {
      (vscode.workspace.workspaceFolders as any) = [];
      await languageServerUtils.setupDB();
      expect(existsSyncSpy).not.toHaveBeenCalled();
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('Should unlink existing and create new db.', async () => {
      await languageServerUtils.setupDB();
      expect(existsSyncSpy).toHaveBeenCalledWith(fakeApexDb);
      expect(unlinkSyncSpy).toHaveBeenCalled();
      expect(apexLanguageServerDatabaseSpy).toHaveBeenCalled();
      expect(extensionUriSpy).toHaveBeenCalledWith(VSCODE_APEX_EXTENSION_NAME);
      expect(joinSpy).toHaveBeenCalled();
      expect(existsSyncSpy).toHaveBeenCalledWith(fakeUrl);
      expect(copyFileSyncSpy).toHaveBeenCalledWith(fakeUrl, fakeApexDb);
    });

    it.only('Should skip unlink and create new db.', async () => {
      existsSyncSpy.mockReturnValueOnce(true).mockReturnValueOnce(false);
      await languageServerUtils.setupDB();
      expect(existsSyncSpy).toHaveBeenCalledWith(fakeApexDb);
      expect(unlinkSyncSpy).not.toHaveBeenCalled();
      expect(copyFileSyncSpy).toHaveBeenCalledWith(fakeUrl, fakeApexDb);
    });

    it('Should skip db create if existing.', async () => {
      existsSyncSpy.mockReturnValue(false);
      await languageServerUtils.setupDB();
      expect(existsSyncSpy).toHaveBeenCalledWith(fakeApexDb);
      expect(copyFileSyncSpy).not.toHaveBeenCalled();
    });

    it('Should log a thrown error.', async () => {
      const handyError = new Error('oh no, file gone');
      existsSyncSpy.mockReset();
      existsSyncSpy.mockReturnValue(false);
      extensionUriSpy.mockImplementation(() => {
        throw handyError;
      });
      await languageServerUtils.setupDB();
      expect(existsSyncSpy).toHaveBeenCalledTimes(1);
      expect(unlinkSyncSpy).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(handyError);
    });
  });
});
