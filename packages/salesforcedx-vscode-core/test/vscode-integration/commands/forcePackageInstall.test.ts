/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import {
  ForcePackageInstallExecutor,
  SelectInstallationKey,
  SelectPackageID
} from '../../../src/commands/forcePackageInstall';
import { nls } from '../../../src/messages';

// tslint:disable:no-unused-expression
describe('Force Package Install', () => {
  describe('SelectPackageID Gatherer', () => {
    const EVENT_CANCEL = 'CANCEL';
    const EVENT_CONTINUE = 'CONTINUE';
    const TEST_PACKAGE_ID = 'testPackageID';
    let inputBoxSpy: sinon.SinonStub;

    beforeEach(() => {
      inputBoxSpy = sinon.stub(vscode.window, 'showInputBox');
    });

    afterEach(() => {
      inputBoxSpy.restore();
    });

    it('Should return cancel if package ID is undefined', async () => {
      inputBoxSpy.onCall(0).returns(undefined);
      const gatherer = new SelectPackageID();
      const response = await gatherer.gather();
      expect(inputBoxSpy.callCount).to.equal(1);
      expect(response.type).to.equal(EVENT_CANCEL);
    });

    it('Should return cancel if packageId is empty string', async () => {
      inputBoxSpy.onCall(0).returns('');
      const gatherer = new SelectPackageID();
      const response = await gatherer.gather();
      expect(inputBoxSpy.callCount).to.equal(1);
      expect(response.type).to.equal(EVENT_CANCEL);
    });

    it('Should return Continue with packageId if user input is non-empty string', async () => {
      inputBoxSpy.onCall(0).returns(TEST_PACKAGE_ID);
      const gatherer = new SelectPackageID();
      const response = await gatherer.gather();
      if (response.type === EVENT_CONTINUE) {
        expect(response.data.packageId).to.equal(TEST_PACKAGE_ID);
      } else {
        expect.fail('Response should be of type ContinueResponse');
      }
    });
  });
  describe('SelectInstallationKey Gatherer', () => {
    const EVENT_CANCEL = 'CANCEL';
    const EVENT_CONTINUE = 'CONTINUE';
    const TEST_INSTALLATION_KEY = 'testInstallationKey';
    let inputBoxSpy: sinon.SinonStub;

    beforeEach(() => {
      inputBoxSpy = sinon.stub(vscode.window, 'showInputBox');
    });

    afterEach(() => {
      inputBoxSpy.restore();
    });

    it('Should return Continue with installation key if user input is string', async () => {
      inputBoxSpy.onCall(0).returns(TEST_INSTALLATION_KEY);
      const gatherer = new SelectInstallationKey();
      const response = await gatherer.gather();
      if (response.type === EVENT_CONTINUE) {
        expect(response.data.installationKey).to.equal(TEST_INSTALLATION_KEY);
      } else {
        expect.fail('Response should be of type ContinueResponse');
      }
    });

    it('Should return cancel if installation key is undefined', async () => {
      inputBoxSpy.onCall(0).returns(undefined);
      const gatherer = new SelectInstallationKey();
      const response = await gatherer.gather();
      expect(inputBoxSpy.callCount).to.equal(1);
      expect(response.type).to.equal(EVENT_CANCEL);
    });

    it('Should return Continue with installation key if user input is empty string', async () => {
      inputBoxSpy.onCall(0).returns('');
      const gatherer = new SelectInstallationKey();
      const response = await gatherer.gather();
      if (response.type === EVENT_CONTINUE) {
        expect(response.data.installationKey).to.equal('');
      } else {
        expect.fail('Response should be of type ContinueResponse');
      }
    });
  });
  describe('Package Install Builder', () => {
    it('Should build the package install command', async () => {
      const TEST_PACKAGE_ID = 'testPackageID';
      const TEST_INSTALLATION_KEY = 'testInstallationKey';
      const forcePackageInstallExecutor = new ForcePackageInstallExecutor();
      const createCommand = forcePackageInstallExecutor.build({
        packageId: TEST_PACKAGE_ID,
        installationKey: TEST_INSTALLATION_KEY
      });
      expect(createCommand.toCommand()).to.equal(
        `sfdx force:package:install --package ${TEST_PACKAGE_ID} --installationkey ${TEST_INSTALLATION_KEY}`
      );
      expect(createCommand.description).to.equal(
        nls.localize('force_package_install_text')
      );
    });
    it('Should build the package install command without installation key', async () => {
      const TEST_PACKAGE_ID = 'testPackageID';
      const TEST_INSTALLATION_KEY = '';
      const forcePackageInstallExecutor = new ForcePackageInstallExecutor();
      const createCommand = forcePackageInstallExecutor.build({
        packageId: TEST_PACKAGE_ID,
        installationKey: TEST_INSTALLATION_KEY
      });
      expect(createCommand.toCommand()).to.equal(
        `sfdx force:package:install --package ${TEST_PACKAGE_ID}`
      );
      expect(createCommand.description).to.equal(
        nls.localize('force_package_install_text')
      );
    });
  });
});
