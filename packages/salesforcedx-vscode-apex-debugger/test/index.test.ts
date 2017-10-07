import { expect } from 'chai';
import * as vscode from 'vscode';
import { ApexDebuggerConfigurationProvider } from '../src/index';

describe('Extension Setup', () => {
  describe('Configuration provider', () => {
    let provider: ApexDebuggerConfigurationProvider;

    beforeEach(() => {
      provider = new ApexDebuggerConfigurationProvider();
    });

    it('Should use context folder path', () => {
      const folder: vscode.WorkspaceFolder = {
        name: 'mySfdxProject',
        index: 0,
        uri: {
          fsPath: '/foo'
        } as vscode.Uri
      };
      const expectedConfig = {
        name: 'Launch Apex Debugger',
        type: 'apex',
        request: 'launch',
        userIdFilter: [],
        requestTypeFilter: [],
        entryPointFilter: '',
        sfdxProject: '/foo'
      } as vscode.DebugConfiguration;

      const configs = provider.provideDebugConfigurations(folder);

      expect(configs).to.deep.equal([expectedConfig]);
    });

    it('Should use default workspaceRoot', () => {
      const expectedConfig = {
        name: 'Launch Apex Debugger',
        type: 'apex',
        request: 'launch',
        userIdFilter: [],
        requestTypeFilter: [],
        entryPointFilter: '',
        sfdxProject: '${workspaceRoot}'
      } as vscode.DebugConfiguration;

      const configs = provider.provideDebugConfigurations(undefined);

      expect(configs).to.deep.equal([expectedConfig]);
    });
  });
});
