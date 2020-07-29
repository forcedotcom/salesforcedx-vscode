/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { GlobalCliEnvironment } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { expect } from 'chai';
import * as shelljs from 'shelljs';
import { assert, createSandbox, SinonSandbox, SinonStub } from 'sinon';
import { window } from 'vscode';
import {
  ENV_SFDX_DISABLE_TELEMETRY,
  SFDX_CONFIG_DISABLE_TELEMETRY
} from '../../../src/constants';
import {
  ConfigUtil,
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
    let getConfigValueStub: SinonStub;

    beforeEach(() => {
      sandboxStub = createSandbox();
      getConfigValueStub = sandboxStub.stub(ConfigUtil, 'getConfigValue');
    });

    afterEach(() => {
      sandboxStub.restore();
    });

    it('Should return true if cli is not installed', async () => {
      getConfigValueStub.withArgs(SFDX_CONFIG_DISABLE_TELEMETRY).returns('');

      const response = await isCLITelemetryAllowed();
      expect(response).to.equal(true);
    });

    it('Should return false if telemetry setting is disabled', async () => {
      getConfigValueStub
        .withArgs(SFDX_CONFIG_DISABLE_TELEMETRY)
        .returns('true');

      const response = await isCLITelemetryAllowed();
      expect(response).to.equal(false);
    });

    it('Should return true if telemetry setting is undefined', async () => {
      getConfigValueStub.withArgs(SFDX_CONFIG_DISABLE_TELEMETRY).returns('');

      const response = await isCLITelemetryAllowed();
      expect(response).to.equal(true);
    });

    it('Should return true if telemetry setting is enabled', async () => {
      getConfigValueStub
        .withArgs(SFDX_CONFIG_DISABLE_TELEMETRY)
        .returns('false');

      const response = await isCLITelemetryAllowed();
      expect(response).to.equal(true);
    });

    it("Should return true if CLI doesn't support telemetry setting", async () => {
      getConfigValueStub.withArgs(SFDX_CONFIG_DISABLE_TELEMETRY).returns('');

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
});
