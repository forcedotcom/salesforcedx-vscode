import { expect } from 'chai';
import {
  ForceOrgOpenContainerExecutor,
  ForceOrgOpenExecutor,
  getExecutor
} from '../../../src/commands/forceOrgOpen';
import { nls } from '../../../src/messages';

// tslint:disable:no-unused-expression
describe('Force Org Open', () => {
  it('should build the org open command', () => {
    const forceOrgOpenContainer = new ForceOrgOpenExecutor();
    const orgOpenCommand = forceOrgOpenContainer.build({});

    expect(orgOpenCommand.toCommand()).to.equal('sfdx force:org:open');
    expect(orgOpenCommand.description).to.equal(
      nls.localize('force_org_open_default_scratch_org_text')
    );
  });

  it('should build the org open command for use in a container', () => {
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
    let originalEnvValue: string;

    beforeEach(() => {
      originalEnvValue = process.env.SFDX_CONTAINER_MODE as string;
    });

    afterEach(() => {
      process.env.SFDX_CONTAINER_MODE = originalEnvValue;
    });

    it('should use ForceOrgOpenExecutor if container mode is not defined', () => {
      process.env.SFDX_CONTAINER_MODE = '';
      expect(getExecutor()).to.be.instanceOf(ForceOrgOpenExecutor);
    });

    it('should use ForceOrgOpenContainerExecutor if container mode is defined', () => {
      process.env.SFDX_CONTAINER_MODE = 'true';
      expect(getExecutor()).to.be.instanceOf(ForceOrgOpenContainerExecutor);
    });
  });
});
