/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as vscode from 'vscode';
import { DebugConfigurationProvider } from '../../../src/adapter/DebugConfigurationProvider';
import { nls } from '../../../src/messages';

describe('Configuration provider', () => {
  let provider: DebugConfigurationProvider;
  const folder: vscode.WorkspaceFolder = {
    name: 'myWorkspaceFolder',
    index: 0,
    uri: {
      fsPath: '/foo'
    } as vscode.Uri
  };

  beforeEach(() => {
    provider = new DebugConfigurationProvider();
  });

  it('Should provide default config', () => {
    const expectedConfig = {
      name: nls.localize('config_name_text'),
      type: nls.localize('config_type_text'),
      request: nls.localize('config_request_type_text'),
      logFile: '${workspaceFolder}/${command:AskForLogFileName}',
      stopOnEntry: true,
      traceLog: true
    } as vscode.DebugConfiguration;

    const configs = provider.provideDebugConfigurations(folder);

    expect(configs).to.deep.equal([expectedConfig]);
  });

  it('Should fill in empty attributes in the config', () => {
    const expectedConfig = {
      name: nls.localize('config_name_text'),
      type: nls.localize('config_type_text'),
      request: nls.localize('config_request_type_text'),
      logFile: '${workspaceFolder}/${command:AskForLogFileName}',
      stopOnEntry: true,
      traceLog: true
    } as vscode.DebugConfiguration;

    const config = provider.resolveDebugConfiguration(folder, {
      name: '',
      type: '',
      request: ''
    });

    expect(config).to.deep.equal(expectedConfig);
  });

  it('Should not modify existing config', () => {
    const expectedConfig = {
      name: 'sampleName',
      type: 'sampleType',
      request: 'sampleConfigType',
      logFile: 'foo.log',
      stopOnEntry: false,
      traceLog: false
    } as vscode.DebugConfiguration;

    const config = provider.resolveDebugConfiguration(folder, expectedConfig);

    expect(config).to.deep.equal(expectedConfig);
  });
});
