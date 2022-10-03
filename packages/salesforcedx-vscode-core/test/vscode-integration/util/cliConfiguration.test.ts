/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Config, ConfigFile, OrgConfigProperties } from '@salesforce/core';
import {
  ConfigUtil,
  getRootWorkspacePath,
  GlobalCliEnvironment
} from '@salesforce/salesforcedx-utils-vscode';
import { doesNotReject, rejects } from 'assert';
import { expect } from 'chai';
import { resolve } from 'dns';
import * as fs from 'fs';
import * as shelljs from 'shelljs';
import { assert, createSandbox, SinonSandbox, SinonStub } from 'sinon';
import { window } from 'vscode';
import { ENV_SFDX_DISABLE_TELEMETRY } from '../../../src/constants';
import { workspaceContext } from '../../../src/context';
import {
  disableCLITelemetry,
  isCLIInstalled,
  isCLITelemetryAllowed,
  showCLINotInstalledMessage
} from '../../../src/util';

describe('SFDX CLI Configuration utility', () => {
  let sandboxStub: SinonSandbox;
  describe('isCLIInstalled', () => {
    let whichStub: SinonStub;

    beforeEach(() => {
      sandboxStub = createSandbox();
      whichStub = sandboxStub.stub(shelljs, 'which');
    });

    afterEach(() => {
      sandboxStub.restore();
    });

    it('Should return false if sfdx cli path is not found', () => {
      whichStub.withArgs('sfdx').returns('');

      const response = isCLIInstalled();
      expect(response).equal(false);
    });

    it('Should return true if sfdx cli path is found', () => {
      whichStub.withArgs('sfdx').returns('Users/some/path/sfdx/cli');

      const response = isCLIInstalled();
      expect(response).equal(true);
    });

    it('Should return false if sfdx cli path query throwns an exception', () => {
      whichStub
        .withArgs('sfdx')
        .throws(new Error('some exception while querying system path'));

      const response = isCLIInstalled();
      expect(response).equal(false);
    });
  });

  describe('showCLINotInstalledMessage', () => {
    let mShowWarning: SinonStub;

    beforeEach(() => {
      sandboxStub = createSandbox();
      mShowWarning = sandboxStub
        .stub(window, 'showWarningMessage')
        .returns(Promise.resolve(null));
    });

    afterEach(() => {
      sandboxStub.restore();
    });

    it('Should show cli install info message', async () => {
      showCLINotInstalledMessage();
      assert.calledOnce(mShowWarning);
    });
  });

  describe('CLI Telemetry', () => {
    let isTelemetryDisabledStub: SinonStub;

    beforeEach(() => {
      sandboxStub = createSandbox();
      isTelemetryDisabledStub = sandboxStub.stub(
        ConfigUtil,
        'isTelemetryDisabled'
      );
    });

    afterEach(() => {
      sandboxStub.restore();
    });

    it('Should return false if telemetry setting is disabled', async () => {
      isTelemetryDisabledStub.resolves('true');

      const response = await isCLITelemetryAllowed();
      expect(response).to.equal(false);
    });

    it('Should return true if telemetry setting is undefined', async () => {
      isTelemetryDisabledStub.resolves(undefined);

      const response = await isCLITelemetryAllowed();
      expect(response).to.equal(true);
    });

    it('Should return true if telemetry setting is enabled', async () => {
      isTelemetryDisabledStub.resolves(false);

      const response = await isCLITelemetryAllowed();
      expect(response).to.equal(true);
    });

    it('Should set an environment variable', async () => {
      const cliEnvSpy = sandboxStub.stub(
        GlobalCliEnvironment.environmentVariables,
        'set'
      );
      disableCLITelemetry();
      expect(cliEnvSpy.firstCall.args).to.eql([
        ENV_SFDX_DISABLE_TELEMETRY,
        'true'
      ]);
    });
  });

  describe('ConfigAggregator integration tests', () => {
    const dummyLocalDefaultUsername = 'test@local.com';

    afterEach(async () => {
      const origDir = process.cwd();
      const rootWorkspacePath = getRootWorkspacePath();
      process.chdir(rootWorkspacePath);
      // const configFile = await Config.create(Config.getDefaultOptions());
      const configFile = await ConfigFile.create(
        Config.getDefaultOptions(false, 'sfdx-config.json')
      );
      configFile.unlinkSync(); // delete the file that was created for the test

      const config = await Config.create(Config.getDefaultOptions());
      config.unlinkSync(); // delete the file that was created for the test

      fs.rmdir('.sf', err => {
        if (err) {
          console.log(err);
        }
      });
      process.chdir(origDir); // Change back to the orig process.cwd
    });

    it.only('Should return the locally configured default username when it exists', async () => {
      let res: (value: string) => void;
      let rej: (reason?: any) => void;
      const resultPromise = new Promise((resolve, rejects) => {
        res = resolve;
        rej = rejects;
      });
      workspaceContext.onOrgChange(async orgUserInfo => {
        console.log('TEST LISTENER');

        console.log('POST flush promises');
        try {
          // Act
          const localProjectDefaultUsernameOrAlias = await ConfigUtil.getDefaultUsernameOrAlias();

          // Assert
          expect(localProjectDefaultUsernameOrAlias).to.equal(
            dummyLocalDefaultUsername
          );
          expect(localProjectDefaultUsernameOrAlias).to.equal(
            orgUserInfo.username
          );

          res('success');
        } catch (e) {
          rej(e);
        }
      });

      // Arrange: create a local config file and set the local project default username
      const origDir = process.cwd();
      const rootWorkspacePath = getRootWorkspacePath();
      process.chdir(rootWorkspacePath);
      const config = await Config.create(Config.getDefaultOptions());
      config.set(OrgConfigProperties.TARGET_ORG, dummyLocalDefaultUsername);
      // after this, the listener should be invoked
      await config.write();
      console.log('config file written in test');
      process.chdir(origDir); // Change back to the orig process.cwd

      return resultPromise;
    });
  });
});
