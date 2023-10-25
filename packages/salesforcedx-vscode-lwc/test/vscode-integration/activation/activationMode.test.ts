import { shared as lspCommon } from '@salesforce/lightning-lsp-common';
import * as chai from 'chai';
import { expect, assert } from 'chai';
import * as sinonChai from 'sinon-chai';
import sinon, { stubInterface, stubObject } from 'ts-sinon';
import * as vscode from 'vscode';
import * as constants from '../../../src/constants';
import { activate } from '../../../src/index';
import { MockExtensionContext } from './MockExtensionContext';

chai.use(sinonChai);

describe('activation modes', () => {
  const sandbox = sinon.createSandbox();
  let mockExtensionContext: vscode.ExtensionContext;

  beforeEach(function() {
    sandbox.spy(constants, 'log');

    mockExtensionContext = stubInterface<vscode.ExtensionContext>();

    // @ts-ignore
    mockExtensionContext.subscriptions = [];

    // @ts-ignore
    mockExtensionContext.asAbsolutePath = path => {
      return path;
    };
  });

  afterEach(function() {
    sandbox.restore();
  });

  it('activates every time when activationMode is set to always', async function() {
    const EXPECTED = 'always';
    // create vscode extensionContext
    mockExtensionContext = new MockExtensionContext(true);
    const mockConfiguration = stubObject<vscode.WorkspaceConfiguration>(
      vscode.workspace.getConfiguration('salesforcedx-vscode-lightning'),
      {
        get: EXPECTED
      }
    );
    sandbox
      .stub(vscode.workspace, 'getConfiguration')
      .returns(mockConfiguration);

    const stub = sandbox.stub(vscode.commands, 'registerCommand');

    await activate(mockExtensionContext);

    assert(stub.called);
  });

  it('activates every time when activationMode is set to always for non LWC projects', async function() {
    const EXPECTED = 'always';
    // create vscode extensionContext
    mockExtensionContext = new MockExtensionContext(true);
    const mockConfiguration = stubObject<vscode.WorkspaceConfiguration>(
      vscode.workspace.getConfiguration('salesforcedx-vscode-lightning'),
      {
        get: EXPECTED
      }
    );
    sandbox
      .stub(vscode.workspace, 'getConfiguration')
      .returns(mockConfiguration);
    sandbox.stub(lspCommon, 'isLWC').returns(false);
    const stub = sandbox.stub(vscode.commands, 'registerCommand');

    await activate(mockExtensionContext);

    assert(stub.called);
  });

  it('does not activate when activationMode is set to off', async function() {
    const logMessage =
      'LWC Language Server activationMode set to off, exiting...';
    const EXPECTED = 'off';

    const mockConfiguration = stubObject<vscode.WorkspaceConfiguration>(
      vscode.workspace.getConfiguration('salesforcedx-vscode-lightning'),
      {
        get: EXPECTED
      }
    );
    sandbox
      .stub(vscode.workspace, 'getConfiguration')
      .returns(mockConfiguration);

    sandbox
      .mock(vscode.commands)
      .expects('registerCommand')
      .never();

    await activate(mockExtensionContext);

    // Verify that we do not call vscode.commands.registerCommand at all
    // We can also verify that we logged the message
    expect(constants.log).calledWith(logMessage);
  });

  it('conditionally activates when activationMode is set to autodetect for LWC projects', async function() {
    const EXPECTED = 'autodetect';
    // create vscode extensionContext
    mockExtensionContext = new MockExtensionContext(true);
    const mockConfiguration = stubObject<vscode.WorkspaceConfiguration>(
      vscode.workspace.getConfiguration('salesforcedx-vscode-lightning'),
      {
        get: EXPECTED
      }
    );

    sandbox.stub(lspCommon, 'isLWC').returns(true);

    sandbox
      .stub(vscode.workspace, 'getConfiguration')
      .returns(mockConfiguration);

    const stub = sandbox.stub(vscode.commands, 'registerCommand');

    await activate(mockExtensionContext);

    assert(stub.called);
  });

  it('does not activate when activationMode is set to autodetect for non-LWC projects', async function() {
    const EXPECTED = 'autodetect';
    // create vscode extensionContext
    mockExtensionContext = new MockExtensionContext(true);
    const mockConfiguration = stubObject<vscode.WorkspaceConfiguration>(
      vscode.workspace.getConfiguration('salesforcedx-vscode-lightning'),
      {
        get: EXPECTED
      }
    );

    sandbox.stub(lspCommon, 'isLWC').returns(false);

    sandbox
      .stub(vscode.workspace, 'getConfiguration')
      .returns(mockConfiguration);

    // Verify
    sandbox
      .mock(vscode.commands)
      .expects('registerCommand')
      .never();

    await activate(mockExtensionContext);
  });
});
