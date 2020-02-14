import * as chai from 'chai';
import { activate } from '../../../src/index';
import * as vscode from 'vscode';
import sinon, { stubInterface, stubObject } from 'ts-sinon';
import * as sinonChai from 'sinon-chai';
import { shared as lspCommon } from '@salesforce/lightning-lsp-common';

chai.use(sinonChai);
const { expect, assert } = chai;

describe('activation modes', () => {
  let sandbox: sinon.SinonSandbox;
  let mockContext: vscode.ExtensionContext;

  beforeEach(function() {
    sandbox = sinon.createSandbox();
    sandbox.spy(console, 'log');

    mockContext = stubInterface<vscode.ExtensionContext>();
    // @ts-ignore
    mockContext.subscriptions = [];
  });

  afterEach(function() {
    sandbox.restore();
  });

  it('activates every time when activationMode is set to always', async function() {
    const EXPECTED = 'always';

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

    await activate(mockContext);

    assert(stub.called);
  });

  it('activates every time when activationMode is set to always for non LWC projects', async function() {
    const EXPECTED = 'always';

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

    await activate(mockContext);

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

    await activate(mockContext);

    // Verify that we do not call vscode.commands.registerCommand at all
    // We can also verify that we console.log the message
    expect(console.log).calledWith(logMessage);
  });

  it('conditionally activates when activationMode is set to autodetect for LWC projects', async function() {
    const EXPECTED = 'autodetect';
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

    await activate(mockContext);

    assert(stub.called);
  });

  it('does not activate when activationMode is set to autodetect for non-LWC projects', async function() {
    const EXPECTED = 'autodetect';
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

    await activate(mockContext);
  });
});
