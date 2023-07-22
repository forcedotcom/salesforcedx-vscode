import { expect } from 'chai';
import { createSandbox, SinonSandbox } from 'sinon';
import * as vscode from 'vscode';
import { SfdxSettingsService } from '../../../src/settings';

describe('SfdxSettingsService', () => {
  let sb: SinonSandbox;
  beforeEach(() => {
    sb = createSandbox();
  });
  afterEach(() => {
    sb.restore();
  });
  describe('when reading workspace preference for clearing output or suppress output', () => {
    it('should return true when underlying workspace configuration for preference', () => {
      sb.stub(vscode.workspace, 'getConfiguration').returns({
        get: () => true
      });
      expect(
        SfdxSettingsService.getEnableClearOutputBeforeEachCommand()
      ).equals(true);
      expect(
        SfdxSettingsService.getEnableSuppressOutputAfterSuccessfulOperation()
      ).equals(true);
    });
    it('should return false if underlying configuration is false', () => {
      sb.stub(vscode.workspace, 'getConfiguration').returns({
        get: () => false
      });
      expect(
        SfdxSettingsService.getEnableClearOutputBeforeEachCommand()
      ).equals(false);
      expect(
        SfdxSettingsService.getEnableSuppressOutputAfterEachCommand()
      ).equals(false);
    });
  });
});
