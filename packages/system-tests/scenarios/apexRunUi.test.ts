/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as util from '@salesforce/salesforcedx-test-utils-vscode/out/src/orgUtils';
import { expect } from 'chai';
import * as path from 'path';
import { CommonActions } from '../src/areas/common';
import { removeWorkspace } from '../src/helpers/workspace';
import { SpectronApplication, VSCODE_BINARY_PATH } from '../src/spectron/application';

const TITLE = 'apex:run UI commands Tests';
const PROJECT_NAME = `project_${new Date().getTime()}`;
const ANONYMOUS_APEX_CODE = `List<Account> acc = [SELECT Id, Name FROM Account Limit 2]; System.debug(acc);`;

describe(TITLE, () => {
  let app: SpectronApplication;
  let common: CommonActions;

  const PROJECT_DIR = path.join(process.cwd(), PROJECT_NAME);

  let username: string;

  before(async () => {
    await util.generateSFProject(PROJECT_NAME);
    username = await util.createScratchOrg(PROJECT_NAME);
    app = new SpectronApplication(VSCODE_BINARY_PATH, TITLE, 2, [PROJECT_DIR]);
    common = new CommonActions(app);

    await app.start();
    await app.wait();
  });

  after(async () => {
    await app.stop();
    await util.deleteScratchOrg(PROJECT_NAME, username);
    await removeWorkspace(PROJECT_DIR);
  });

  it('Should execute anonymous apex from current editor document', async () => {
    await app.command('workbench.action.files.newUntitledFile');
    await app.waitUI();

    await common.type(ANONYMOUS_APEX_CODE);
    await app.waitUI();

    await app.command('workbench.action.quickOpen');
    await common.type('>SFDX: Execute Anonymous Apex with Editor Contents');
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.waitUI();

    const consoleHtml = await common.getConsoleOutput();

    for (let i = 0; i < consoleHtml.length; i++) {
      if (consoleHtml[i].indexOf('exit code') > 0) {
        expect(consoleHtml[i]).to.contain('exit code 0');
      }
    }
  });

  it('Should execute anonymous apex from current text selection', async () => {
    await app.command('workbench.action.files.newUntitledFile');
    await app.waitUI();

    await common.type(ANONYMOUS_APEX_CODE);
    await app.waitUI();

    await app.command('editor.action.selectAll');

    await app.command('workbench.action.quickOpen');
    await common.type('>SFDX: Execute Anonymous Apex with Currently Selected Text');
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.waitUI();

    const consoleHtml = await common.getConsoleOutput();

    for (let i = 0; i < consoleHtml.length; i++) {
      if (consoleHtml[i].indexOf('exit code') > 0) {
        expect(consoleHtml[i]).to.contain('exit code 0');
      }
    }
  });
});
