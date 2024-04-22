/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import { fail } from 'assert';
import { expect } from 'chai';
import * as fs from 'fs';
import * as sinon from 'sinon';
import { createSandbox } from 'sinon';
import * as util from 'util';
import * as vscode from 'vscode';
import { GenerateManifestExecutor } from '../../../src/commands/projectGenerateManifest';
import { nls } from '../../../src/messages';

const classPath = '/force-app/main/default/classes/';
const CLASS_1 = 'Apex1';
const CLASS_2 = 'Apex2';
const URI_1 = vscode.Uri.parse(classPath + CLASS_1);
const URI_2 = vscode.Uri.parse(classPath + CLASS_2);
const EMPTY_MANIFEST = `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
  %s
  <version>53.0</version>
</Package>`;
const APEX_MANIFEST = util.format(
  EMPTY_MANIFEST,
  `
<types>
  %s
  <name>ApexClass</name>
</types>`
);

const env = createSandbox();
let openTextDocumentSpy: sinon.SinonSpy;

describe('Project Generate Manifest', () => {
  describe('Happy Path Unit Tests', () => {
    beforeEach(() => {
      openTextDocumentSpy = env.spy(vscode.workspace, 'openTextDocument');
    });

    afterEach(() => {
      env.restore();
    });

    it('Should create first manifest from single sourceUri', async () => {
      const packageXML = util.format(
        APEX_MANIFEST,
        `<member>${CLASS_1}</member>`
      );
      env.stub(ComponentSet, 'fromSource').returns({
        getPackageXml: () => {
          return packageXML;
        }
      });
      env.stub(fs, 'existsSync').returns(false);
      env.stub(fs, 'mkdirSync').returns(undefined);
      env.stub(fs, 'writeFileSync').returns(undefined);
      const packageName = 'package' + generateRandomSuffix() + '.xml';
      const executor = new GenerateManifestExecutor(
        [URI_1.fsPath],
        packageName
      );
      await executor.run({
        type: 'CONTINUE',
        data: ''
      });

      expect(openTextDocumentSpy.calledOnce).to.equal(true);
    });

    it('Should create manifest from list of uris', async () => {
      const packageXML = util.format(
        APEX_MANIFEST,
        `<member>${CLASS_1}</member>\n<member>${CLASS_2}</member>\n`
      );
      env.stub(ComponentSet, 'fromSource').returns({
        getPackageXml: () => {
          return packageXML;
        }
      });
      env
        .stub(fs, 'existsSync')
        .onFirstCall()
        .returns(true)
        .onSecondCall()
        .returns(false);
      env.stub(fs, 'writeFileSync').returns(undefined);
      const packageName = 'package' + generateRandomSuffix() + '.xml';
      const executor = new GenerateManifestExecutor(
        [URI_1.fsPath, URI_2.fsPath],
        packageName
      );
      await executor.run({
        type: 'CONTINUE',
        data: ''
      });

      expect(openTextDocumentSpy.calledOnce).to.equal(true);
    });

    it('Should create but not save manifest if cancelled', async () => {
      const writeFileSpy = env.spy(fs, 'writeFileSync');
      const packageXML = util.format(
        APEX_MANIFEST,
        `<member>${CLASS_1}</member>\n<member>${CLASS_2}</member>\n`
      );
      env.stub(ComponentSet, 'fromSource').returns({
        getPackageXml: () => {
          return packageXML;
        }
      });
      env
        .stub(fs, 'existsSync')
        .onFirstCall()
        .returns(true)
        .onSecondCall()
        .returns(false);
      const executor = new GenerateManifestExecutor(
        [URI_1.fsPath, URI_2.fsPath],
        undefined
      );
      await executor.run({
        type: 'CONTINUE',
        data: ''
      });

      expect(openTextDocumentSpy.calledOnce).to.equal(true);
      expect(writeFileSpy.called).to.equal(false);
    });

    it('Should use default manifest name if none is supplied', async () => {
      const packageXML = util.format(
        APEX_MANIFEST,
        `<member>${CLASS_1}</member>\n<member>${CLASS_2}</member>\n`
      );
      env.stub(ComponentSet, 'fromSource').returns({
        getPackageXml: () => {
          return packageXML;
        }
      });
      env
        .stub(fs, 'existsSync')
        .onFirstCall()
        .returns(true)
        .onSecondCall()
        .returns(false);
      env.stub(fs, 'writeFileSync').returns(undefined);
      const executor = new GenerateManifestExecutor(
        [URI_1.fsPath, URI_2.fsPath],
        ''
      );
      await executor.run({
        type: 'CONTINUE',
        data: ''
      });

      expect(openTextDocumentSpy.calledOnce).to.equal(true);
      const pathArg = openTextDocumentSpy.getCalls()[0].args[0];
      expect(pathArg).to.contain('package.xml');
    });

    it('Should append correct extension', async () => {
      const packageXML = util.format(
        APEX_MANIFEST,
        `<member>${CLASS_1}</member>\n<member>${CLASS_2}</member>\n`
      );
      env.stub(ComponentSet, 'fromSource').returns({
        getPackageXml: () => {
          return packageXML;
        }
      });
      env
        .stub(fs, 'existsSync')
        .onFirstCall()
        .returns(true)
        .onSecondCall()
        .returns(false);
      env.stub(fs, 'writeFileSync').returns(undefined);
      const randomSuffix = generateRandomSuffix();
      const packageName = 'package' + randomSuffix + '.txt';
      const executor = new GenerateManifestExecutor(
        [URI_1.fsPath, URI_2.fsPath],
        packageName
      );
      await executor.run({
        type: 'CONTINUE',
        data: ''
      });

      expect(openTextDocumentSpy.calledOnce).to.equal(true);
      const pathArg = openTextDocumentSpy.getCalls()[0].args[0];
      expect(pathArg).to.contain('package' + randomSuffix + '.xml');
    });

    it('Should not throw an exception for an empty xml', async () => {
      const packageXML = util.format(EMPTY_MANIFEST, '');
      env.stub(ComponentSet, 'fromSource').returns({
        getPackageXml: () => {
          return packageXML;
        }
      });
      env
        .stub(fs, 'existsSync')
        .onFirstCall()
        .returns(true)
        .onSecondCall()
        .returns(false);
      const executor = new GenerateManifestExecutor(
        [URI_1.fsPath, URI_2.fsPath],
        undefined
      );
      await executor.run({
        type: 'CONTINUE',
        data: ''
      });

      expect(openTextDocumentSpy.calledOnce).to.equal(true);
    });
  });

  describe('Exception Handling Unit Tests', () => {
    beforeEach(() => {
      openTextDocumentSpy = env.spy(vscode.workspace, 'openTextDocument');
    });

    afterEach(() => {
      env.restore();
    });

    it('Should handle exception while creating component set', async () => {
      env
        .stub(ComponentSet, 'fromSource')
        .throws(new Error(nls.localize('error_creating_packagexml')));
      let exceptionThrown = false;
      try {
        const executor = new GenerateManifestExecutor(
          [URI_1.fsPath, URI_2.fsPath],
          ''
        );
        await executor.run({
          type: 'CONTINUE',
          data: ''
        });

        fail('Should have thrown exception');
      } catch (e) {
        expect(e.message).to.contain('package.xml');
        exceptionThrown = true;
      }
      expect(exceptionThrown).to.equal(true);
      expect(openTextDocumentSpy.called).to.equal(false);
    });

    it('Should enforce unique manifest names', async () => {
      const packageXML = util.format(
        APEX_MANIFEST,
        `<member>${CLASS_1}</member>`
      );
      env.stub(ComponentSet, 'fromSource').returns({
        getPackageXml: () => {
          return packageXML;
        }
      });
      env.stub(fs, 'existsSync').returns(true);
      const fileName = 'duplicatePackageName';

      let exceptionThrown = false;
      try {
        const executor = new GenerateManifestExecutor([URI_1.fsPath], fileName);
        await executor.run({
          type: 'CONTINUE',
          data: ''
        });
      } catch (e) {
        exceptionThrown = true;
        expect(e.message).to.contain(fileName);
      }
      expect(exceptionThrown).to.equal(true);
      expect(openTextDocumentSpy.called).to.equal(false);
    });
  });
});

const generateRandomSuffix = () =>
  (Date.now() + Math.round(Math.random() * 1000)).toString();
