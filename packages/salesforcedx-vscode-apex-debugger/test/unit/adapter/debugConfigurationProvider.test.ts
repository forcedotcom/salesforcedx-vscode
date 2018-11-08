/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  DEBUGGER_LAUNCH_TYPE,
  DEBUGGER_TYPE
} from '@salesforce/salesforcedx-apex-debugger/out/src';
import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { DebugConfigurationProvider } from '../../../src/adapter/debugConfigurationProvider';
import { nls } from '../../../src/messages';

// tslint:disable:no-unused-expression
describe('Configuration provider', () => {
  let provider: DebugConfigurationProvider;
  let getConfigSpy: sinon.SinonSpy;
  const folder: vscode.WorkspaceFolder = {
    name: 'mySfdxProject',
    index: 0,
    uri: {
      fsPath: '/foo'
    } as vscode.Uri
  };

  beforeEach(() => {
    provider = new DebugConfigurationProvider();
    getConfigSpy = sinon.spy(DebugConfigurationProvider, 'getConfig');
  });

  afterEach(() => {
    getConfigSpy.restore();
  });

  it('Should provide default config', () => {
    const expectedConfig = {
      name: nls.localize('config_name_text'),
      type: DEBUGGER_TYPE,
      request: DEBUGGER_LAUNCH_TYPE,
      userIdFilter: [],
      requestTypeFilter: [],
      entryPointFilter: '',
      sfdxProject: '/foo'
    } as vscode.DebugConfiguration;

    const configs = provider.provideDebugConfigurations(folder);

    expect(configs).to.deep.equal([expectedConfig]);
    expect(getConfigSpy.calledOnce).to.be.true;
  });

  it('Should fill in empty attributes in the config', async () => {
    const config = await provider.resolveDebugConfiguration(folder, {
      name: '',
      type: '',
      request: ''
    });

    if (config) {
      expect(config.name).to.equals(nls.localize('config_name_text'));
      expect(config.type).to.equals(DEBUGGER_TYPE);
      expect(config.request).to.equals(DEBUGGER_LAUNCH_TYPE);
      expect(config.userIdFilter).to.be.an('array').that.is.empty;
      expect(config.requestTypeFilter).to.be.an('array').that.is.empty;
      expect(config.entryPointFilter).to.equals('');
      expect(config.sfdxProject).to.equals('/foo');
      expect(config.workspaceSettings).to.not.equals(undefined);
      expect(config.lineBreakpointInfo).to.not.equals(undefined);
    } else {
      expect.fail(
        'Did not get configuration information from resolveDebugConfiguration'
      );
    }
  });
});
