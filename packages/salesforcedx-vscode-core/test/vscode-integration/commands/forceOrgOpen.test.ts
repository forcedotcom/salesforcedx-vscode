/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { SinonStub, stub } from 'sinon';
import {
  ForceOrgOpenContainerExecutor,
  ForceOrgOpenExecutor,
  getExecutor
} from '../../../src/commands';
import { SALESFORCE_LANDING_PAGE, SALESFORCE_LANDING_PAGE_MAPPING } from '../../../src/constants';
import { SfdxCoreSettings } from '../../../src/settings/sfdxCoreSettings';

import { nls } from '../../../src/messages';

// tslint:disable:no-unused-expression
describe('Force Org Open', () => {

  let getLandingPageSettingStub: SinonStub;
  beforeEach(() => {
    getLandingPageSettingStub = stub(
      SfdxCoreSettings.prototype,
      'getLandingPageSetting'
    );

  });
  afterEach(() => {
    getLandingPageSettingStub.restore();
  });

  it('should build the org open command', () => {

    getLandingPageSettingStub.returns('Default');
    const forceOrgOpenContainer = new ForceOrgOpenExecutor();
    const orgOpenCommand = forceOrgOpenContainer.build({});

    expect(orgOpenCommand.toCommand()).to.equal('sfdx force:org:open');
    expect(orgOpenCommand.description).to.equal(
      nls.localize('force_org_open_default_scratch_org_text')
    );
  });

  it('should build the org open command with path', () => {

    const LANDING_PAGE_SETTING_NAME = 'Home (Classic)';
    const LANDING_PAGE_SETTING_MAPPING = SALESFORCE_LANDING_PAGE_MAPPING[LANDING_PAGE_SETTING_NAME];

    getLandingPageSettingStub.returns(LANDING_PAGE_SETTING_NAME);
    const forceOrgOpenContainer = new ForceOrgOpenExecutor();
    const orgOpenCommand = forceOrgOpenContainer.build({});

    expect(orgOpenCommand.toCommand()).to.equal(`sfdx force:org:open -p ${LANDING_PAGE_SETTING_MAPPING}`);
    expect(orgOpenCommand.description).to.equal(
      nls.localize('force_org_open_default_scratch_org_text')
    );
  });

  it('should build the org open command with custom path', () => {
    const LANDING_PAGE_SETTING_NAME = 'Other';
    const LANDING_PAGE_CUSTOM_SETTING_NAME = 'lightning/setup/ObjectManager/home';

    getLandingPageSettingStub.returns(LANDING_PAGE_SETTING_NAME);
    let getCustomLandingPageValueStub: SinonStub;
    getCustomLandingPageValueStub = stub(
      SfdxCoreSettings.prototype,
      'getLandingPageCustomValue'
    ).returns(LANDING_PAGE_CUSTOM_SETTING_NAME);

    const forceOrgOpenContainer = new ForceOrgOpenExecutor();
    const orgOpenCommand = forceOrgOpenContainer.build({});

    expect(orgOpenCommand.toCommand()).to.equal(`sfdx force:org:open -p ${LANDING_PAGE_CUSTOM_SETTING_NAME}`);
    expect(orgOpenCommand.description).to.equal(
      nls.localize('force_org_open_default_scratch_org_text')
    );
    getCustomLandingPageValueStub.restore();
  });

  it('should build the org open command for use in a container', () => {
    getLandingPageSettingStub.returns('Default');
    const forceOrgOpenContainer = new ForceOrgOpenContainerExecutor();
    const orgOpenCommand = forceOrgOpenContainer.build({});

    expect(orgOpenCommand.toCommand()).to.equal(
      'sfdx force:org:open --urlonly --json --loglevel fatal'
    );
    expect(orgOpenCommand.description).to.equal(
      nls.localize('force_org_open_default_scratch_org_text')
    );
  });

  describe('Executor is chosen based on environment', () => {
    afterEach(() => {
      delete process.env.SFDX_CONTAINER_MODE;
    });
    it('should use ForceOrgOpenExecutor if container mode is not defined', () => {
      expect(getExecutor()).to.be.instanceOf(ForceOrgOpenExecutor);
    });
    it('should use ForceOrgOpenExecutor if container mode is empty', () => {
      process.env.SFDX_CONTAINER_MODE = '';
      expect(getExecutor()).to.be.instanceOf(ForceOrgOpenExecutor);
    });

    it('should use ForceOrgOpenContainerExecutor if container mode is defined', () => {
      process.env.SFDX_CONTAINER_MODE = 'true';
      expect(getExecutor()).to.be.instanceOf(ForceOrgOpenContainerExecutor);
    });
  });
});
