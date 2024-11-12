/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  DEBUGGER_LAUNCH_TYPE,
  DEBUGGER_TYPE,
  LAST_OPENED_LOG_FOLDER_KEY,
  LAST_OPENED_LOG_KEY
} from '@salesforce/salesforcedx-apex-replay-debugger/out/src/constants';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { DebugConfiguration, ExtensionContext, extensions, Uri, WorkspaceFolder } from 'vscode';
import { DebugConfigurationProvider } from '../../../src/adapter/debugConfigurationProvider';
import { updateLastOpened } from '../../../src/index';
import { nls } from '../../../src/messages';
import { MockApexExtension } from './MockApexExtension';

// tslint:disable:no-unused-expression
describe('Configuration provider', () => {
  let provider: DebugConfigurationProvider;
  let getConfigSpy: sinon.SinonSpy;
  const folder: WorkspaceFolder = {
    name: 'myWorkspaceFolder',
    index: 0,
    uri: {
      fsPath: '/foo'
    } as Uri
  };
  let mockApexExtension: sinon.SinonStub;

  beforeEach(() => {
    getConfigSpy = sinon.spy(DebugConfigurationProvider, 'getConfig');
    mockApexExtension = sinon.stub(extensions, 'getExtension').returns(new MockApexExtension());
    provider = new DebugConfigurationProvider();
  });

  afterEach(() => {
    getConfigSpy.restore();
    mockApexExtension.restore();
  });

  it('Should provide default config', () => {
    const expectedConfig = {
      name: nls.localize('config_name_text'),
      type: DEBUGGER_TYPE,
      request: DEBUGGER_LAUNCH_TYPE,
      logFile: '${command:AskForLogFileName}',
      stopOnEntry: true,
      trace: true
    } as DebugConfiguration;

    const configs = provider.provideDebugConfigurations(folder);

    expect(configs).to.deep.equal([expectedConfig]);
    expect(getConfigSpy.calledOnce).to.be.true;
  });

  it('Should provide config with specified log file', () => {
    const expectedConfig = {
      name: nls.localize('config_name_text'),
      type: DEBUGGER_TYPE,
      request: DEBUGGER_LAUNCH_TYPE,
      logFile: '/path/foo.cls',
      stopOnEntry: true,
      trace: true
    } as DebugConfiguration;

    const config = DebugConfigurationProvider.getConfig('/path/foo.cls');
    expect(config).to.deep.equal(expectedConfig);
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
      expect(config.logFile).to.equals('${command:AskForLogFileName}');
      expect(config.stopOnEntry).to.equals(true);
      expect(config.trace).to.equals(true);
      expect(config.projectPath).to.not.equals(undefined);
      expect(config.lineBreakpointInfo).to.not.equals(undefined);
      expect(mockApexExtension.calledOnce).to.be.true;
    } else {
      expect.fail('Did not get configuration information from resolveDebugConfiguration');
    }
  });

  it('Should not modify existing config', async () => {
    const config = await provider.resolveDebugConfiguration(folder, {
      name: 'sampleName',
      type: 'sampleType',
      request: 'sampleConfigType',
      logFile: 'foo.log',
      stopOnEntry: false,
      trace: false
    });

    if (config) {
      expect(config.name).to.equals('sampleName');
      expect(config.type).to.equals('sampleType');
      expect(config.request).to.equals('sampleConfigType');
      expect(config.logFile).to.equals('foo.log');
      expect(config.stopOnEntry).to.equals(false);
      expect(config.trace).to.equals(false);
      expect(config.projectPath).to.not.equals(undefined);
      expect(config.lineBreakpointInfo).to.not.equals(undefined);
      expect(mockApexExtension.calledOnce).to.be.true;
    } else {
      expect.fail('Did not get configuration information from resolveDebugConfiguration');
    }
  });
});

describe('extension context log path tests', () => {
  const mementoKeys: string[] = [];
  const mementoValues: string[] = [];
  const mContext = {
    workspaceState: {
      update: (key: string, value: any) => {
        mementoKeys.push(key);
        mementoValues.push(value as string);
      }
    }
  };

  it('Should update the extension context', () => {
    updateLastOpened(mContext as any as ExtensionContext, '/foo/bar/logfilename.log');
    expect(mementoKeys).to.have.same.members([`${LAST_OPENED_LOG_KEY}`, `${LAST_OPENED_LOG_FOLDER_KEY}`]);
    expect(mementoValues).to.have.same.members(['/foo/bar/logfilename.log', '/foo/bar']);
  });
});
