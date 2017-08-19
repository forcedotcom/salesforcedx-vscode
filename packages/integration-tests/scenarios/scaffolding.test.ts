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

const TITLE = 'Scaffolding Commands Tests';

const workspacePath = path.join(
  createWorkspace(path.join(process.cwd(), 'assets', 'sfdx-simple')),
  'sfdx-simple'
);

describe('Scaffolding commands', () => {
  let app: SpectronApplication;
  let common: CommonActions;

  beforeEach(async () => {
    app = new SpectronApplication(VSCODE_BINARY_PATH, TITLE, 2, [
      workspacePath
    ]);
    common = new CommonActions(app);

    await app.start();
    await app.wait();
  });

  afterEach(async () => {
    return await app.stop();
  });

  it('Should create Apex class', async () => {
    await app.command('workbench.action.quickOpen');
    await common.type('>SFDX: Create Apex Class');
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.wait();

    const fileName = `apexClass_${new Date().getTime()}`;

    await common.type(fileName);
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.wait();
    await common.type('force-app/main/default/classes');
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.wait();

    // Check that the new apex class is opened in a new tab
    expect(await common.getTab(`${fileName}.cls`)).to.be.not.undefined;
  });
});
