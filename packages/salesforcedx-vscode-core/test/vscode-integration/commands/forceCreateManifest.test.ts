/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import { fail } from 'assert';
import { expect } from 'chai';
import util = require('util');
import * as sinon from 'sinon';
import { createSandbox } from 'sinon';
import * as vscode from 'vscode';
import {
  forceCreateManifest
} from '../../../src/commands';
import { nls } from '../../../src/messages';

const classPath = '/force-app/main/default/classes/';
const class1 = 'apex1.cls';
const class2 = 'apex2.cls';
const uri1 = vscode.Uri.parse(classPath + class1);
const uri2 = vscode.Uri.parse(classPath + class2);
const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
  <types>
    %s
    <name>ApexClass</name>
  </types>
</Package>`;

describe('Force Create Manifest', () => {
  let env: sinon.SinonSandbox;
  let openDocStub: sinon.SinonStub;
  let showDocStub: sinon.SinonStub;

  before(() => {
    env = createSandbox();
    openDocStub = env.stub(vscode.workspace, 'openTextDocument').resolves(null);
    showDocStub = env.stub(vscode.window, 'showTextDocument').resolves(null);
  });

  afterEach(() => env.restore());

  it('Should create manifest from single sourceUri', async () => {
    const packageXML = util.format(manifest, `<member>${class1}</member>`);
    env.stub(ComponentSet, 'fromSource').returns({
      getPackageXml: () => {
        return packageXML;
      }
    });
    await forceCreateManifest(uri1, undefined);

    expect(openDocStub.calledOnce).to.equal(true);
    expect(showDocStub.calledOnce).to.equal(true);
  });

  it('Should create manifest from list of uris', async () => {
    const packageXML = util.format(manifest, `<member>${class1}</member>\n<member>${class2}</member>\n`);
    env.stub(ComponentSet, 'fromSource').returns({
      getPackageXml: () => {
        return packageXML;
      }
    });
    await forceCreateManifest(uri1, [uri1, uri2]);

    expect(openDocStub.calledOnce).to.equal(true);
    expect(showDocStub.calledOnce).to.equal(true);
  });

  it('Should handle exception while creating component set', async () => {
    env.stub(ComponentSet, 'fromSource').throws(
      new Error(nls.localize('error_creating_packagexml'))
    );
    let exceptionThrown = false;
    try {
      await forceCreateManifest(uri1, [uri2]);
      fail('Should have thrown exception');
    } catch (e) {
      expect(e.message).to.contain('package.xml');
      exceptionThrown = true;
    }
    expect(exceptionThrown).to.equal(true);
  });
});
