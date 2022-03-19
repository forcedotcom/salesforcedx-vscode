import { notificationService } from '@salesforce/salesforcedx-utils-vscode/out/src/commands';
import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import {isNameMatch, RenameLwcComponentExecutor} from '../../../src/commands/forceRenameLightningComponent';

const lwcPath = vscode.Uri.parse('/force-app/main/default/lwc');
const auraPath = vscode.Uri.parse('/force-app/main/default/aura/');
const lwcComponent = 'hero';
const auraComponent = 'page';
const itemsInHero = ['_test_', 'hero.css', 'hero.html', 'hero.js', 'hero.js-meta.xml', 'templateOne.html'];
const itemsInPage = ['_test_', 'page.auradoc', 'page.cmp', 'page.cmp-meta.xml', 'page.css', 'page.design', 'page.svg', 'pageController.js', 'pageHelper.js', 'pageRenderer.js', 'templateOne.css'];

const env = sinon.createSandbox();
let renameStub: sinon.SinonStub;
let statStub: sinon.SinonStub;

describe('Force Rename Lightning Component', () => {
  describe('Happy Path Unit Test', () => {
    beforeEach(() => {
      renameStub = env.stub(fs, 'renameSync').returns(undefined);
      statStub = env.stub(fs, 'statSync').returns({
        isFile: () => {
          return false;
        }
      });
    });

    afterEach(() => {
      env.restore();
    });

    it('should rename the files and folder with new name under the same path', async () => {
      const sourceUri = vscode.Uri.joinPath(lwcPath, lwcComponent);
      env.stub(fs, 'readdirSync')
        .onFirstCall().returns([])
        .onSecondCall().returns([])
        .onThirdCall().returns([itemsInHero[1]]);
      const executor = new RenameLwcComponentExecutor(sourceUri.fsPath);
      await executor.run({
        type: 'CONTINUE',
        data: {name: 'hero1'}
      });
      const oldFilePath = path.join(sourceUri.fsPath, 'hero.css');
      const newFilePath = path.join(sourceUri.fsPath, 'hero1.css');
      const newFolderPath = path.join(lwcPath.fsPath, 'hero1');
      expect(renameStub.callCount).to.equal(2);
      expect(renameStub.calledWith(oldFilePath, newFilePath)).to.equal(true);
      expect(renameStub.calledWith(sourceUri.fsPath, newFolderPath)).to.equal(true);
    });

    it('should only rename the files and folder that have same name with LWC component', async () => {
      const sourceUri = vscode.Uri.joinPath(lwcPath, lwcComponent);
      env.stub(fs, 'readdirSync')
      .onFirstCall().returns([])
      .onSecondCall().returns([])
      .onThirdCall().returns(itemsInHero);
      const executor = new RenameLwcComponentExecutor(sourceUri.fsPath);
      await executor.run({
        type: 'CONTINUE',
        data: {name: 'hero1'}
      });
      expect(renameStub.callCount).to.equal(5);
    });

    it('should only rename the files and folder that have same name with Aura component', async () => {
      const sourceUri = vscode.Uri.joinPath(auraPath, auraComponent);
      env.stub(fs, 'readdirSync')
      .onFirstCall().returns([])
      .onSecondCall().returns([])
      .onThirdCall().returns(itemsInPage);
      const executor = new RenameLwcComponentExecutor(sourceUri.fsPath);
      await executor.run({
        type: 'CONTINUE',
        data: {name: 'page1'}
      });
      expect(renameStub.callCount).to.equal(10);
    });

    it('should show the warning message once rename is done', async () => {
      const sourceUri = vscode.Uri.joinPath(lwcPath, lwcComponent);
      env.stub(fs, 'readdirSync')
      .onFirstCall().returns([])
      .onSecondCall().returns([])
      .onThirdCall().returns([itemsInHero[1]]);
      const warningSpy = env.spy(notificationService, 'showWarningMessage');
      const executor = new RenameLwcComponentExecutor(sourceUri.fsPath);
      await executor.run({
        type: 'CONTINUE',
        data: {name: 'hero1'}
      });
      expect(warningSpy.callCount).to.equal(1);
    });
  });

  describe('Exception handling', () => {
    beforeEach(() => {
      renameStub = env.stub(fs, 'rename').returns(undefined);
      statStub = env.stub(fs, 'statSync').returns({
        isFile: () => {
          return false;
        }
      });
    });

    afterEach(() => {
      env.restore();
    });

    it('should not rename when input text is empty', async () => {
      const sourceUri = vscode.Uri.joinPath(lwcPath, lwcComponent);
      env.stub(fs, 'readdirSync')
        .onFirstCall().returns([])
        .onSecondCall().returns([])
        .onThirdCall().returns([itemsInHero[1]]);
      const executor = new RenameLwcComponentExecutor(sourceUri.fsPath);
      await executor.run({
        type: 'CONTINUE',
        data: {}
      });
      expect(renameStub.callCount).to.equal(0);
    });

    it('should not show warning message when input text is empty', async () => {
      const sourceUri = vscode.Uri.joinPath(lwcPath, lwcComponent);
      env.stub(fs, 'readdirSync')
      .onFirstCall().returns([])
      .onSecondCall().returns([])
      .onThirdCall().returns([itemsInHero[1]]);
      const warningSpy = env.spy(notificationService, 'showWarningMessage');
      const executor = new RenameLwcComponentExecutor(sourceUri.fsPath);
      await executor.run({
        type: 'CONTINUE',
        data: {}
      });
      expect(warningSpy.callCount).to.equal(0);
    });

    it('should enforce unique component name under LWC and Aura and show error message for duplicate name', async () => {
      const sourceUri = vscode.Uri.joinPath(lwcPath, lwcComponent);
      env.stub(fs, 'readdirSync')
       .onFirstCall().returns([lwcComponent])
       .onSecondCall().returns([]);
      let exceptionThrown = false;
      try {
        const executor = new RenameLwcComponentExecutor(sourceUri.fsPath);
        await executor.run({
          type: 'CONTINUE',
          data: {name: 'hero'}
        });
      } catch (e) {
        exceptionThrown = true;
      }
      expect(exceptionThrown).to.equal(true);
      expect(renameStub.callCount).to.equal(0);
    });
  });
});

describe ('#isNameMatch', () => {
  it('should return true if file name and component name match for essential LWC files', () => {
    const componentName = 'hero';
    const componentPath = path.join(lwcPath.fsPath, lwcComponent);
    expect(isNameMatch(itemsInHero[1], componentName, componentPath)).to.equal(true);
    expect(isNameMatch(itemsInHero[2], componentName, componentPath)).to.equal(true);
    expect(isNameMatch(itemsInHero[3], componentName, componentPath)).to.equal(true);
    expect(isNameMatch(itemsInHero[4], componentName, componentPath)).to.equal(true);
  });

  it('should return true of file name and component name match for essential Aura files', () => {
    const componentName = 'page';
    const componentPath = path.join(auraPath.fsPath, auraComponent);
    expect(isNameMatch(itemsInPage[1], componentName, componentPath)).to.equal(true);
    expect(isNameMatch(itemsInPage[2], componentName, componentPath)).to.equal(true);
    expect(isNameMatch(itemsInPage[3], componentName, componentPath)).to.equal(true);
    expect(isNameMatch(itemsInPage[4], componentName, componentPath)).to.equal(true);
    expect(isNameMatch(itemsInPage[5], componentName, componentPath)).to.equal(true);
    expect(isNameMatch(itemsInPage[6], componentName, componentPath)).to.equal(true);
    expect(isNameMatch(itemsInPage[7], componentName, componentPath)).to.equal(true);
    expect(isNameMatch(itemsInPage[8], componentName, componentPath)).to.equal(true);
    expect(isNameMatch(itemsInPage[9], componentName, componentPath)).to.equal(true);
  });

  it('should return false if file type is not in LWC or Aura or file name and component name do not match', () => {
    const lwcComponentPath = path.join(lwcPath.fsPath, lwcComponent);
    const auraComponentPath = path.join(auraPath.fsPath, auraComponent);
    expect(isNameMatch('hero.jpg', 'hero', lwcComponentPath)).to.equal(false);
    expect(isNameMatch('hero1.css', 'hero', lwcComponentPath)).to.equal(false);
    expect(isNameMatch('page.jpg', 'page', auraComponentPath)).to.equal(false);
    expect(isNameMatch('page1.css', 'hero', auraComponentPath)).to.equal(false);
  });
});
