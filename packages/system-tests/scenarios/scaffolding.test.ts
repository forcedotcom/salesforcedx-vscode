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

const WORKSPACE_PATH = path.join(
  createWorkspace(path.join(process.cwd(), 'assets', 'sfdx-simple')),
  'sfdx-simple'
);

describe('Scaffolding commands', () => {
  let app: SpectronApplication;
  let common: CommonActions;

  beforeEach(async () => {
    app = new SpectronApplication(VSCODE_BINARY_PATH, TITLE, 2, [
      WORKSPACE_PATH
    ]);
    common = new CommonActions(app);

    await app.start();
    await app.wait();
  });

  afterEach(async () => {
    return await app.stop();
  });

  it('Should create Apex class', async () => {
    // Invoke SFDX: Create Apex Class command by name
    await app.command('workbench.action.quickOpen');
    await common.type('>SFDX: Create Apex Class');
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.wait();

    const fileName = `apexClass_${new Date().getTime()}`;

    // Enter file name
    await common.type(fileName);
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.wait();

    // Enter desired location (without slashes so it's OS-independent)
    await common.type('force-appmaindefaultclasses');
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.wait();

    // Check that the new apex class is opened in a new tab
    const apexClassTab = await common.getTab(`${fileName}.cls`);
    expect(apexClassTab).to.be.not.undefined;
    if (apexClassTab) {
      await common.closeTab();
    }
  });

  it('Should create Visualforce component', async () => {
    // Invoke SFDX: Create Visualforce Component command by name
    await app.command('workbench.action.quickOpen');
    await common.type('>SFDX: Create Visualforce Component');
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.wait();

    const fileName = `vfComponent_${new Date().getTime()}`;

    // Enter file name
    await common.type(fileName);
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.wait();

    // Enter desired location (without slashes so it's OS-independent)
    await common.type('force-appmaindefaultpages');
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.wait();

    // Check that the new apex class is opened in a new tab
    const visualforceComponentTab = await common.getTab(
      `${fileName}.component`
    );
    expect(visualforceComponentTab).to.be.not.undefined;
    if (visualforceComponentTab) {
      await common.closeTab();
    }
  });

  it('Should create Visualforce page', async () => {
    // Invoke SFDX: Create Visualforce Page command by name
    await app.command('workbench.action.quickOpen');
    await common.type('>SFDX: Create Visualforce Page');
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.wait();

    const fileName = `vfPage_${new Date().getTime()}`;

    // Enter file name
    await common.type(fileName);
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.wait();

    // Enter desired location (without slashes so it's OS-independent)
    await common.type('force-appmaindefaultpages');
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.wait();

    // Check that the new visualforce class is opened in a new tab
    const visualforcePageTab = await common.getTab(`${fileName}.page`);
    expect(visualforcePageTab).to.be.not.undefined;
    if (visualforcePageTab) {
      await common.closeTab();
    }
  });

  it('Should create Lightning app', async () => {
    // Invoke SFDX: Create Lightning App command by name
    await app.command('workbench.action.quickOpen');
    await common.type('>SFDX: Create Lightning App');
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.wait();

    const fileName = `lightningApp_${new Date().getTime()}`;

    // Enter file name
    await common.type(fileName);
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.wait();

    // Enter desired location (without slashes so it's OS-independent)
    await common.type('force-appmaindefaultaura');
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.wait();

    // Check that the new lightning app is opened in a new tab
    const lightningAppTab = await common.getTab(`${fileName}.app`);
    expect(lightningAppTab).to.be.not.undefined;
    if (lightningAppTab) {
      await common.closeTab();
    }

    await app.command('workbench.action.quickOpen');
    await common.type(fileName);
    const elCount = await common.getQuickOpenElements();
    expect(elCount).to.equal(6);
  });
});
