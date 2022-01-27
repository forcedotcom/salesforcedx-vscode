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
import * as fs from 'fs';
import { getRootWorkspacePath } from '../../../src/util';
import { join } from 'path';

const classPath = '/force-app/main/default/classes/';
const class1 = 'Apex1';
const class2 = 'Apex2';
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
  describe('Happy Paths', () => {

    let env: sinon.SinonSandbox;
    let openDocSpy: sinon.SinonSpy;
    let inputBoxSpy: sinon.SinonStub;

    before(() => {
      env = createSandbox();
    });

    beforeEach(() => {
      inputBoxSpy = env.stub(vscode.window, 'showInputBox');
      openDocSpy = env.spy(vscode.workspace, 'openTextDocument');
    });

    afterEach(() => {
      env.restore();
    });

    it.only('Should create manifest from single sourceUri', async () => {
      const packageXML = util.format(manifest, `<member>${class1}</member>`);
      env.stub(ComponentSet, 'fromSource').returns({
        getPackageXml: () => {
          return packageXML;
        }
      });
      env.stub(fs, 'existsSync').returns(false);
      env.stub(fs, 'writeFileSync').returns(undefined);
      const packageName = 'package' + generateRandomSuffix() + '.xml';
      inputBoxSpy.onCall(0).returns(packageName);
      await forceCreateManifest(uri1, undefined);

      expect(openDocSpy.calledOnce).to.equal(true);
    });

    it('Should create manifest from list of uris', async () => {
      const packageXML = util.format(manifest, `<member>${class1}</member>\n<member>${class2}</member>\n`);
      env.stub(ComponentSet, 'fromSource').returns({
        getPackageXml: () => {
          return packageXML;
        }
      });
      env.stub(fs, 'existsSync')
        .onFirstCall()
        .returns(true)
        .onSecondCall()
        .returns(false);
      env.stub(fs, 'writeFileSync').returns(undefined);
      const packageName = 'package' + generateRandomSuffix() + '.xml';
      inputBoxSpy.onCall(0).returns(packageName);
      await forceCreateManifest(uri1, [uri1, uri2]);

      expect(openDocSpy.calledOnce).to.equal(true);
    });

    it('Should create but not save manifest if cancelled', async () => {
      const writeFileSpy = env.spy(fs, 'writeFileSync');
      const packageXML = util.format(manifest, `<member>${class1}</member>\n<member>${class2}</member>\n`);
      env.stub(ComponentSet, 'fromSource').returns({
        getPackageXml: () => {
          return packageXML;
        }
      });
      env.stub(fs, 'existsSync')
        .onFirstCall()
        .returns(true)
        .onSecondCall()
        .returns(false);
      inputBoxSpy.onCall(0).returns(undefined);
      await forceCreateManifest(uri1, [uri1, uri2]);

      expect(openDocSpy.calledOnce).to.equal(true);
      expect(writeFileSpy.called).to.equal(false);
    });

  });

  describe('Exception Handling', () => {

    let env: sinon.SinonSandbox;
    let openDocSpy: sinon.SinonSpy;
    let inputBoxSpy: sinon.SinonStub;

    before(() => {
      env = createSandbox();
    });

    beforeEach(() => {
      inputBoxSpy = env.stub(vscode.window, 'showInputBox');
      openDocSpy = env.spy(vscode.workspace, 'openTextDocument');
    });

    afterEach(() => {
      env.restore();
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

    it('Should enforce unique manifest names', async() => {
      const packageXML = util.format(manifest, `<member>${class1}</member>`);
      env.stub(ComponentSet, 'fromSource').returns({
        getPackageXml: () => {
          return packageXML;
        }
      });
      env.stub(fs, 'existsSync').returns(true);
      const fileName = 'duplicatePackageName';
      inputBoxSpy.resolves(fileName);
  
      let exceptionThrown = false;
      try {
        await forceCreateManifest(uri1, undefined);
      } catch (e) {
        exceptionThrown = true;
        expect(e.message).to.contain(fileName);
      }
      expect(exceptionThrown).to.equal(true);
    });

  /*

  it('Should handle exception while creating untitled document', async() => {
  });

  it('Should handle exception while saving document', async() => {
  });*/

  });

});

function generateRandomSuffix() {
  return (Date.now() + Math.round(Math.random() * 1000)).toString();
}