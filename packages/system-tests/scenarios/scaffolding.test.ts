/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as path from 'path';
import { CommonActions } from '../src/areas/common';
import { createWorkspace } from '../src/helpers/workspace';
import { SpectronApplication, VSCODE_BINARY_PATH } from '../src/spectron/application';

const TITLE = 'Scaffolding Commands Tests';

const WORKSPACE_PATH = path.join(createWorkspace(path.join(process.cwd(), 'assets', 'sfdx-simple')), 'sfdx-simple');

describe('Scaffolding commands', () => {
  let app: SpectronApplication;
  let common: CommonActions;

  before(async () => {
    app = new SpectronApplication(VSCODE_BINARY_PATH, TITLE, 2, [WORKSPACE_PATH]);
    common = new CommonActions(app);

    await app.start();
    await app.wait();
  });

  after(async () => {
    return await app.stop();
  });

  it('Should create Apex class', async () => {
    // Invoke SFDX: Create Apex Class command by name
    await app.command('workbench.action.quickOpen');
    await common.type('>SFDX: Create Apex Class');
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.waitUI();

    const fileName = `apexClass_${new Date().getTime()}`;

    // Enter file name
    await common.type(fileName);
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.waitUI();

    // Enter desired location (without slashes so it's OS-independent)
    await common.type('force-appmaindefaultclasses');
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.waitUI();

    // Check that the new apex class is opened in a new tab
    const apexClassTab = await common.getTab(`${fileName}.cls`);
    expect(apexClassTab).to.be.not.undefined;
    if (apexClassTab) {
      await common.closeTab();
    }
  });

  it('Should create Apex trigger', async () => {
    // Invoke SFDX: Create Apex Trigger command by name
    await app.command('workbench.action.quickOpen');
    await common.type('>SFDX: Create Apex Trigger');
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.waitUI();

    const fileName = `apexTrigger_${new Date().getTime()}`;

    // Enter file name
    await common.type(fileName);
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.waitUI();

    // Enter desired location (without slashes so it's OS-independent)
    await common.type('force-appmaindefaulttriggers');
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.waitUI();

    // Check that the new apex trigger is opened in a new tab
    const apexTriggerTab = await common.getTab(`${fileName}.trigger`);
    expect(apexTriggerTab).to.be.not.undefined;
    if (apexTriggerTab) {
      await common.closeTab();
    }
  });

  it('Should create Visualforce component', async () => {
    // Invoke SFDX: Create Visualforce Component command by name
    await app.command('workbench.action.quickOpen');
    await common.type('>SFDX: Create Visualforce Component');
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.waitUI();

    const fileName = `vfComponent_${new Date().getTime()}`;

    // Enter file name
    await common.type(fileName);
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.waitUI();

    // Enter desired location (without slashes so it's OS-independent)
    await common.type('force-appmaindefaultcomponents');
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.waitUI();

    // Check that the new apex class is opened in a new tab
    const visualforceComponentTab = await common.getTab(`${fileName}.component`);
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
    await app.waitUI();

    const fileName = `vfPage_${new Date().getTime()}`;

    // Enter file name
    await common.type(fileName);
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.waitUI();

    // Enter desired location (without slashes so it's OS-independent)
    await common.type('force-appmaindefaultpages');
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.waitUI();

    // Check that the new visualforce class is opened in a new tab
    const visualforcePageTab = await common.getTab(`${fileName}.page`);
    expect(visualforcePageTab).to.be.not.undefined;
    if (visualforcePageTab) {
      await common.closeTab();
    }
  });

  it('Should create Aura app', async () => {
    // Invoke SFDX: Create Aura App command by name
    await app.command('workbench.action.quickOpen');
    await common.type('>SFDX: Create Aura App');
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.waitUI();

    const fileName = `lightningApp_${new Date().getTime()}`;

    // Enter file name
    await common.type(fileName);
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.waitUI();

    // Enter desired location (without slashes so it's OS-independent)
    await common.type('force-appmaindefaultaura');
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.waitUI();

    // Check that the new lightning app is opened in a new tab
    const lightningAppTab = await common.getTab(`${fileName}.app`);
    expect(lightningAppTab).to.be.not.undefined;
    if (lightningAppTab) {
      await common.closeTab();
    }
  });

  it('Should create Aura component', async () => {
    // Invoke SFDX: Create Aura Component command by name
    await app.command('workbench.action.quickOpen');
    await common.type('>SFDX: Create Aura Component');
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.waitUI();

    const fileName = `lightningCmp_${new Date().getTime()}`;

    // Enter file name
    await common.type(fileName);
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.waitUI();

    // Enter desired location (without slashes so it's OS-independent)
    await common.type('force-appmaindefaultaura');
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.waitUI();

    // Check that the new lightning cmp is opened in a new tab
    const lightningComponentTab = await common.getTab(`${fileName}.cmp`);
    expect(lightningComponentTab).to.be.not.undefined;
    if (lightningComponentTab) {
      await common.closeTab();
    }
  });

  it('Should create Aura event', async () => {
    // Invoke SFDX: Create Aura event command by name
    await app.command('workbench.action.quickOpen');
    await common.type('>SFDX: Create Aura Event');
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.waitUI();

    const fileName = `lightningEvt_${new Date().getTime()}`;

    // Enter file name
    await common.type(fileName);
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.waitUI();

    // Enter desired location (without slashes so it's OS-independent)
    await common.type('force-appmaindefaultaura');
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.waitUI();

    // Check that the new lightning evt is opened in a new tab
    const lightningEventTab = await common.getTab(`${fileName}.evt`);
    expect(lightningEventTab).to.be.not.undefined;
    if (lightningEventTab) {
      await common.closeTab();
    }
  });

  it('Should create Aura interface', async () => {
    // Invoke SFDX: Create Aura interface command by name
    await app.command('workbench.action.quickOpen');
    await common.type('>SFDX: Create Aura Interface');
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.waitUI();

    const fileName = `lightningIntf_${new Date().getTime()}`;

    // Enter file name
    await common.type(fileName);
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.waitUI();

    // Enter desired location (without slashes so it's OS-independent)
    await common.type('force-appmaindefaultaura');
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.waitUI();

    // Check that the new lightning intf is opened in a new tab
    const lightningInterfaceTab = await common.getTab(`${fileName}.intf`);
    expect(lightningInterfaceTab).to.be.not.undefined;
    if (lightningInterfaceTab) {
      await common.closeTab();
    }
  });

  it('Should create Lightning LWC', async () => {
    // Invoke SFDX: Create LWC Bundle command by name
    await app.command('workbench.action.quickOpen');
    await common.type('>SFDX: Create Lightning Web Component');
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.waitUI();

    const fileName = `lwc_${new Date().getTime()}`;

    // Enter file name
    await common.type(fileName);
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.waitUI();

    // Enter desired location (without slashes so it's OS-independent)
    await common.type('force-appmaindefaultlwc');
    await app.client.keys(['NULL', 'Enter', 'NULL'], false);
    await app.waitUI();

    // Check that the new LWC bundle .js file is opened in a new tab
    const lwcBundleTab = await common.getTab(`${fileName}.js`);
    expect(lwcBundleTab).to.be.not.undefined;
    if (lwcBundleTab) {
      await common.closeTab();
    }
  });
});

describe('Empty VSCode workspace', () => {
  let app: SpectronApplication;
  let common: CommonActions;

  beforeEach(async () => {
    app = new SpectronApplication(VSCODE_BINARY_PATH, TITLE, 2);
    common = new CommonActions(app);

    await app.start();
    await app.wait();
  });

  afterEach(async () => {
    return await app.stop();
  });

  it('Should only show create project command for non-SFDX workspace', async () => {
    await app.command('workbench.action.quickOpen');
    await common.type('>SFDX:');
    await app.waitUI();
    const quickOpenText = await common.getQuickOpenElementsText();
    expect(quickOpenText).to.contain('SFDX: Create Project');
  });
});
