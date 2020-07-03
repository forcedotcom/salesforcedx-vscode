/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  ForceConfigGet,
  GlobalCliEnvironment
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { expect } from 'chai';
import * as shelljs from 'shelljs';
import { assert, SinonStub, stub } from 'sinon';
import { window } from 'vscode';
import {
  ENV_SFDX_DISABLE_TELEMETRY,
  SFDX_CONFIG_DISABLE_TELEMETRY
} from '../../../src/constants';
import {
  disableCLITelemetry,
  isCLIInstalled,
  isCLITelemetryAllowed,
  showCLINotInstalledMessage
} from '../../../src/util';

describe('SFDX CLI Configuration utility', () => {
  describe('isCLIInstalled', () => {
    let whichStub: SinonStub;

    beforeEach(() => {
      whichStub = stub(shelljs, 'which');
    });

    afterEach(() => {
      whichStub.restore();
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
      mShowWarning = stub(window, 'showWarningMessage').returns(
        Promise.resolve(null)
      );
    });

    afterEach(() => {
      mShowWarning.restore();
    });

    it('Should show cli install info message', async () => {
      showCLINotInstalledMessage();
      assert.calledOnce(mShowWarning);
    });
  });

  describe('CLI Telemetry', () => {
    let whichStub: SinonStub;
    let configGetSpy: SinonStub;
    let cliEnvSpy: SinonStub;

    beforeEach(() => {
      whichStub = stub(shelljs, 'which');
      cliEnvSpy = stub(GlobalCliEnvironment.environmentVariables, 'set');
      configGetSpy = stub(ForceConfigGet.prototype, 'getConfig').returns(
        {} as Map<string, string>
      );
    });

    afterEach(() => {
      whichStub.restore();
      cliEnvSpy.restore();
      configGetSpy.restore();
    });

    it('Should return true if cli is not installed', async () => {
      whichStub.withArgs('sfdx').returns('');

      const response = await isCLITelemetryAllowed();
      expect(response).to.equal(true);
    });

    it('Should return false if telemetry setting is disabled', async () => {
      whichStub.withArgs('sfdx').returns('Users/some/path/sfdx/cli');

      const config = new Map<string, string>();
      config.set(SFDX_CONFIG_DISABLE_TELEMETRY, 'true');
      configGetSpy.returns(config);

      const response = await isCLITelemetryAllowed();
      expect(response).to.equal(false);
    });

    it('Should return true if telemetry setting is undefined', async () => {
      whichStub.withArgs('sfdx').returns('Users/some/path/sfdx/cli');
      configGetSpy.returns(new Map<string, string>());

      const response = await isCLITelemetryAllowed();
      expect(response).to.equal(true);
    });

    it('Should return true if telemetry setting is enabled', async () => {
      whichStub.withArgs('sfdx').returns('Users/some/path/sfdx/cli');

      const config = new Map<string, string>();
      config.set(SFDX_CONFIG_DISABLE_TELEMETRY, 'false');
      configGetSpy.returns(config);

      const response = await isCLITelemetryAllowed();
      expect(response).to.equal(true);
    });

    it("Should return true if CLI doesn't support telemetry setting", async () => {
      whichStub.withArgs('sfdx').returns('Users/some/path/sfdx/cli');

      configGetSpy.throws('NoSetting');

      const response = await isCLITelemetryAllowed();
      expect(response).to.equal(true);
    });

    it('Should set an environment variable', async () => {
      disableCLITelemetry();
      expect(cliEnvSpy.firstCall.args).to.eql([
        ENV_SFDX_DISABLE_TELEMETRY,
        'true'
      ]);
    });
  });
});
