/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as vscode from 'vscode';
import { DebugConfigurationProvider } from '../../../src/adapter/debugConfigurationProvider';
import { DEBUGGER_LAUNCH_TYPE, DEBUGGER_TYPE } from '../../../src/constants';
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
      type: DEBUGGER_TYPE,
      request: DEBUGGER_LAUNCH_TYPE,
      logFile: '${command:AskForLogFileName}',
      stopOnEntry: true,
      trace: true
    } as vscode.DebugConfiguration;

    const configs = provider.provideDebugConfigurations(folder);

    expect(configs).to.deep.equal([expectedConfig]);
  });

  it('Should fill in empty attributes in the config', () => {
    const expectedConfig = {
      name: nls.localize('config_name_text'),
      type: DEBUGGER_TYPE,
      request: DEBUGGER_LAUNCH_TYPE,
      logFile: '${command:AskForLogFileName}',
      stopOnEntry: true,
      trace: true
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
      trace: false
    } as vscode.DebugConfiguration;

    const config = provider.resolveDebugConfiguration(folder, {
      name: 'sampleName',
      type: 'sampleType',
      request: 'sampleConfigType',
      logFile: 'foo.log',
      stopOnEntry: false,
      trace: false
    });

    expect(config).to.deep.equal(expectedConfig);
  });
});
