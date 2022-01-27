/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { testSetup } from '@salesforce/core/lib/testSetup';
import { SfdxCommandlet } from '@salesforce/salesforcedx-utils-vscode/out/src';
import { notificationService } from '@salesforce/salesforcedx-utils-vscode/out/src/commands';
import { expect } from 'chai';
import { createSandbox, SinonSandbox } from 'sinon';
import * as vscode from 'vscode';
import { forceLaunchReplayDebugger } from '../../../src/commands/forceLaunchReplayDebugger';
import { nls } from '../../../src/messages';
import { ApexTestOutlineProvider } from '../../../src/views/testOutlineProvider';

const $$ = testSetup();

// tslint:disable:no-unused-expression
describe('Force Launch Replay Debugger', () => {
  let sb: SinonSandbox;

  beforeEach(async () => {
    sb = createSandbox();
  });

  afterEach(() => {
    sb.restore();
  });

  it('should return an error when the editor is not found', async () => {
    sb.stub(vscode.window, 'activeTextEditor')
      .get(() => undefined);

    const showErrorMessageStub = sb.stub(
      notificationService,
      'showErrorMessage'
    );

    await forceLaunchReplayDebugger();

    expect(showErrorMessageStub.called).to.equal(true);
    expect(
      showErrorMessageStub.calledWith(nls.localize('unable_to_locate_editor'))
    ).to.equal(true);
  });

  it('should return an error when the document\'s URI is not found', async () => {
    sb.stub(vscode.window, 'activeTextEditor')
      .get(() => ({
        document: {
          uri: undefined
        }
      }));

    const showErrorMessageStub = sb.stub(
      notificationService,
      'showErrorMessage'
    );

    await forceLaunchReplayDebugger();

    expect(showErrorMessageStub.called).to.equal(true);
    expect(
      showErrorMessageStub.calledWith(nls.localize('unable_to_locate_document'))
    ).to.equal(true);
  });

  it('should return an error when the file type is not anon apex and is not an apex test class', async () => {
    sb.stub(vscode.window, 'activeTextEditor')
      .get(() => ({
        document: {
          uri: vscode.Uri.file('foo.txt')
        }
      }));

    const showErrorMessageStub = sb.stub(
      notificationService,
      'showErrorMessage'
    );

    sb.stub(ApexTestOutlineProvider.prototype, 'refresh')
      .returns(undefined);

    sb.stub(ApexTestOutlineProvider.prototype, 'getTestClassName')
      .returns(undefined);

    await forceLaunchReplayDebugger();

    expect(showErrorMessageStub.called).to.equal(true);
    expect(
      showErrorMessageStub.calledWith(nls.localize('command_available_for_anon_apex_or_apex_test_only'))
    ).to.equal(true);
  });

  it('should call SfdxCommandlet.run() if file is anon apex', async () => {
    sb.stub(vscode.window, 'activeTextEditor')
      .get(() => ({
        document: {
          uri: vscode.Uri.file('foo.apex')
        }
      }));

    const runStub = sb.stub(SfdxCommandlet.prototype, 'run')
      .returns(undefined);

    await forceLaunchReplayDebugger();

    expect(runStub.called).to.equal(true);
  });

  it('should execute the sfdx.force.test.view.debugTests command if file is an apex test class', async () => {
    sb.stub(vscode.window, 'activeTextEditor')
      .get(() => ({
        document: {
          uri: vscode.Uri.file('foo.cls')
        }
      }));

    sb.stub(ApexTestOutlineProvider.prototype, 'refresh')
      .returns(undefined);

    sb.stub(ApexTestOutlineProvider.prototype, 'getTestClassName')
      .returns('foo.cls');

    sb.stub(SfdxCommandlet.prototype, 'run')
      .returns(undefined);

    const executeCommandStub = sb.stub(vscode.commands, 'executeCommand')
      .returns(undefined);

    await forceLaunchReplayDebugger();

    expect(executeCommandStub.called).to.equal(true);
    expect(
      executeCommandStub.calledWith('sfdx.force.test.view.debugTests')
    ).to.equal(true);
  });
});
