/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// tslint:disable:no-unused-expression
import * as util from '@salesforce/salesforcedx-utils-vscode/out/src/test/orgUtils';
import { expect } from 'chai';
import * as path from 'path';
import { CommonActions } from '../src/areas/common';
import { removeWorkspace } from '../src/helpers/workspace';
import {
  SpectronApplication,
  VSCODE_BINARY_PATH
} from '../src/spectron/application';

const TITLE = 'force:soql:query UI commands Tests';
const PROJECT_NAME = `project_${new Date().getTime()}`;

describe(TITLE, () => {
  let app: SpectronApplication;
  let common: CommonActions;

  const PROJECT_DIR = path.join(process.cwd(), PROJECT_NAME);

  let username: string;

  before(async () => {
    await util.createSFDXProject(PROJECT_NAME);
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

  it('Should execute SOQL query from input box', async () => {
    // Invoke SFDX: Execute SOQL Query command by name
    await app.command('workbench.action.quickOpen');
    await common.type('>SFDX: Execute SOQL Query...');
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.wait();

    const query = `SELECT Id, Name FROM Account`;

    // Enter SOQL query
    await common.type(query);
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.wait();

    // Select REST API
    await common.type('REST API');
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.wait();

    const consoleHtml = await common.getConsoleOutput();
    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < consoleHtml.length; i++) {
      if (consoleHtml[i].indexOf('exit code') > 0) {
        expect(consoleHtml[i]).to.contain('exit code 0');
      }
    }
  });

  it('Should execute SOQL query with current selection', async () => {
    // Open new untitled file
    await app.command('workbench.action.files.newUntitledFile');
    await app.wait();

    // Enter SOQL query in active editor
    const query = `SELECT Id, Name FROM Account`;
    await common.type(query);
    await app.wait();

    // Select all text in the current window
    await app.command('editor.action.selectAll');

    // Invoke SFDX: Execute SOQL Query command by name
    await app.command('workbench.action.quickOpen');
    await common.type('>SFDX: Execute SOQL Query with Currently Selected Text');
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.wait();

    // Select REST API
    await common.type('REST API');
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.wait();

    const consoleHtml = await common.getConsoleOutput();
    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < consoleHtml.length; i++) {
      if (consoleHtml[i].indexOf('exit code') > 0) {
        expect(consoleHtml[i]).to.contain('exit code 0');
      }
    }
  });

  it('Should execute SOQL query against the Tooling API', async () => {
    // Invoke SFDX: Execute SOQL Query command by name
    await app.command('workbench.action.quickOpen');
    await common.type('>SFDX: Execute SOQL Query...');
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.wait();

    const query = `SELECT Id FROM ApexClassMember`;

    // Enter SOQL query
    await common.type(query);
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.wait();

    // Select Tooling API
    await common.type('Tooling API');
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.wait();

    const consoleHtml = await common.getConsoleOutput();
    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < consoleHtml.length; i++) {
      if (consoleHtml[i].indexOf('exit code') > 0) {
        expect(consoleHtml[i]).to.contain('exit code 0');
      }
    }
  });
});
