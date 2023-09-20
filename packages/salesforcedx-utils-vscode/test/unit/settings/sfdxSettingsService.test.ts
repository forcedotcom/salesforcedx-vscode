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
  describe('when reading workspace preference for clearing output', () => {
    it('should return true when underlying workspace configuration for preference', () => {
      sb.stub(vscode.workspace, 'getConfiguration').returns({
        get: () => true
      } as any);
      expect(
        SfdxSettingsService.getEnableClearOutputBeforeEachCommand()
      ).equals(true);
    });
    it('should return false if underlying configuration is false', () => {
      sb.stub(vscode.workspace, 'getConfiguration').returns({
        get: () => false
      } as any);
      expect(
        SfdxSettingsService.getEnableClearOutputBeforeEachCommand()
      ).equals(false);
    });
  });
});
