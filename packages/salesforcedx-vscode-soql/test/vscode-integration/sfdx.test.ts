import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as sfdx from '../../src/sfdx';

describe('sfdx utils should', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('displays an error if can not get connection to org', async () => {
    sandbox.stub(sfdx.workspaceContext, 'getConnection').throws();
    const vscodeErrorMessageSpy = sandbox.spy(
      vscode.window,
      'showErrorMessage'
    );
    await sfdx.withSFConnection(async () => {});
    sfdx.debouncedShowChannelAndErrorMessage.flush();
    expect(vscodeErrorMessageSpy.callCount).to.equal(1);
  });
});
