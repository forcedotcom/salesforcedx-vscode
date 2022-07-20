import { expect } from 'chai';
import * as proxyquire from 'proxyquire';
import { createSandbox, SinonSandbox } from 'sinon';
import { vscodeStub } from '../commands/mocks';

const { SfdxSettings } = proxyquire.noCallThru()(
  '../../../src/settings/index',
  {
    vscode: vscodeStub
  }
);

describe('SfdxSettingsService', () => {
  let sb: SinonSandbox;
  beforeEach(() => {
    sb = createSandbox();
  });
  afterEach(() => {
    sb.restore();
  });
  describe('when reading workspace preference for clearing output', () => {
    it('should return true when underlying workspace configuration for preference', () => {
      sb.stub(vscodeStub.workspace, 'getConfiguration').returns({
        get: () => true
      });
      expect(SfdxSettings.getEnableClearOutputBeforeEachCommand()).equals(true);
    });
    it('should return false if underlying configuration is false', () => {
      sb.stub(vscodeStub.workspace, 'getConfiguration').returns({
        get: () => false
      });
      expect(SfdxSettings.getEnableClearOutputBeforeEachCommand()).equals(false);
    });
  });
});
