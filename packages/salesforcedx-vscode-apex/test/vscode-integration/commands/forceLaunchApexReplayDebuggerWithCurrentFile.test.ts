/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { testSetup } from '@salesforce/core/lib/testSetup';
import {
  fileUtils,
  notificationService,
  SfdxCommandlet
} from '@salesforce/salesforcedx-utils-vscode';
import { expect } from 'chai';
import { createSandbox, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import { forceLaunchApexReplayDebuggerWithCurrentFile } from '../../../src/commands/forceLaunchApexReplayDebuggerWithCurrentFile';
import { nls } from '../../../src/messages';
import { ApexTestOutlineProvider } from '../../../src/views/testOutlineProvider';

const $$ = testSetup();

describe('Force Launch Replay Debugger', () => {
  const sb = createSandbox();
  let flushFilePathStub: SinonStub;
  beforeEach(async () => {
    flushFilePathStub = sb.stub(fileUtils, 'flushFilePath');
  });

  afterEach(() => {
    sb.restore();
  });

  it('should return an error when the editor is not found', async () => {
    sb.stub(vscode.window, 'activeTextEditor').get(() => undefined);

    const showErrorMessageStub = sb.stub(
      notificationService,
      'showErrorMessage'
    );

    await forceLaunchApexReplayDebuggerWithCurrentFile();

    expect(showErrorMessageStub.called).to.equal(true);
    expect(
      showErrorMessageStub.calledWith(nls.localize('unable_to_locate_editor'))
    ).to.equal(true);
  });

  it("should return an error when the document's URI is not found", async () => {
    sb.stub(vscode.window, 'activeTextEditor').get(() => ({
      document: {
        uri: undefined
      }
    }));

    const showErrorMessageStub = sb.stub(
      notificationService,
      'showErrorMessage'
    );

    await forceLaunchApexReplayDebuggerWithCurrentFile();

    expect(showErrorMessageStub.called).to.equal(true);
    expect(
      showErrorMessageStub.calledWith(nls.localize('unable_to_locate_document'))
    ).to.equal(true);
  });

  it('should return an error when not a log file, not an anon apex file, and not an apex test class', async () => {
    sb.stub(vscode.window, 'activeTextEditor').get(() => ({
      document: {
        uri: vscode.Uri.file('foo.txt')
      }
    }));

    const showErrorMessageStub = sb.stub(
      notificationService,
      'showErrorMessage'
    );

    sb.stub(ApexTestOutlineProvider.prototype, 'refresh').returns(undefined);

    sb.stub(ApexTestOutlineProvider.prototype, 'getTestClassName').returns(
      undefined
    );

    flushFilePathStub.returns(undefined);

    await forceLaunchApexReplayDebuggerWithCurrentFile();

    expect(showErrorMessageStub.called).to.equal(true);
    expect(
      showErrorMessageStub.calledWith(
        nls.localize('launch_apex_replay_debugger_unsupported_file')
      )
    ).to.equal(true);
  });

  it('should call executeCommand() if file is a log file', async () => {
    sb.stub(vscode.window, 'activeTextEditor').get(() => ({
      document: {
        uri: vscode.Uri.file('foo.log')
      }
    }));

    const executeCommandSpy = sb
      .stub(vscode.commands, 'executeCommand')
      .resolves(true);

    await forceLaunchApexReplayDebuggerWithCurrentFile();

    expect(executeCommandSpy.called).to.equal(true);
    expect(
      executeCommandSpy.calledWith('sfdx.launch.replay.debugger.logfile')
    ).to.equal(true);
  });

  it('should call SfdxCommandlet.run() if file is an anon apex file', async () => {
    sb.stub(vscode.window, 'activeTextEditor').get(() => ({
      document: {
        uri: vscode.Uri.file('foo.apex')
      }
    }));

    const runStub = sb.stub(SfdxCommandlet.prototype, 'run').returns(undefined);

    await forceLaunchApexReplayDebuggerWithCurrentFile();

    expect(runStub.called).to.equal(true);
  });

  it('should call executeCommand if file is an apex test class', async () => {
    sb.stub(vscode.window, 'activeTextEditor').get(() => ({
      document: {
        uri: vscode.Uri.file('foo.cls')
      }
    }));

    sb.stub(ApexTestOutlineProvider.prototype, 'refresh').returns(undefined);

    sb.stub(ApexTestOutlineProvider.prototype, 'getTestClassName').returns(
      'foo.cls'
    );

    sb.stub(SfdxCommandlet.prototype, 'run').returns(undefined);

    flushFilePathStub.returns('foo.cls');

    const executeCommandSpy = sb
      .stub(vscode.commands, 'executeCommand')
      .resolves(true);

    await forceLaunchApexReplayDebuggerWithCurrentFile();

    expect(executeCommandSpy.called).to.equal(true);
    expect(
      executeCommandSpy.calledWith('sfdx.force.test.view.debugTests')
    ).to.equal(true);
  });
});
