/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// tslint:disable:no-unused-expression
import { expect } from 'chai';
import * as path from 'path';
import { CommonActions } from '../src/areas/common';
import { createWorkspace } from '../src/helpers/workspace';
import {
  SpectronApplication,
  VSCODE_BINARY_PATH
} from '../src/spectron/application';

const WORKSPACE_PATH = path.join(
  createWorkspace(path.join(process.cwd(), 'assets', 'sfdx-simple')),
  'sfdx-simple'
);

const TITLE = 'Integrated Terminal Tests';
const SFDX_SET_CLIENT_IDS = 'SFDX_SET_CLIENT_IDS';

describe(TITLE, () => {
  let app: SpectronApplication;
  let common: CommonActions;

  before(async () => {
    app = new SpectronApplication(VSCODE_BINARY_PATH, TITLE, 2, [
      WORKSPACE_PATH
    ]);
    common = new CommonActions(app);

    await app.start();
    await app.wait();
  });

  after(async () => {
    return await app.stop();
  });

  it('Should open terminal and check that new terminals will have SFDX_SET_CLIENT_IDS', async () => {
    // Show terminal
    await app.command('workbench.action.quickOpen');
    await common.type('>Terminal: Focus Terminal');
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.wait();

    // Enter terminal command
    if (process.platform === 'win32') {
      await common.type(`echo %${SFDX_SET_CLIENT_IDS}%`);
    } else {
      await common.type(`echo $${SFDX_SET_CLIENT_IDS}`);
    }
    await common.enter();
    await app.wait();

    const output = await app.client.getTerminalText();
    expect(output).to.contain('sfdx-vscode');
  });
});
