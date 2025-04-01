/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { createSandbox, SinonSandbox, SinonSpy, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import { soqlBuilderToggle } from '../../../src/commands';
import { BUILDER_VIEW_TYPE, EDITOR_VIEW_TYPE } from '../../../src/constants';
import { telemetryService } from '../../../src/telemetry';

describe('soqlBuilderToggle should', () => {
  let sb: SinonSandbox;
  let telemetryStub: SinonStub;
  let executeCommandSpy: SinonSpy;

  beforeEach(() => {
    sb = createSandbox();
    telemetryStub = sb.stub(telemetryService, 'sendCommandEvent') as SinonStub;
    executeCommandSpy = sb.spy(vscode.commands, 'executeCommand') as unknown as SinonSpy;
  });

  afterEach(async () => {
    sb.restore();
  });

  it('sends telemetry and opens builder when vscode has active text editor mode', async () => {
    sb.stub(vscode.window, 'activeTextEditor').get(() => {
      return {} as vscode.TextEditor;
    });
    await soqlBuilderToggle({} as vscode.Uri);

    expect(telemetryStub.called).is.true;
    expect(executeCommandSpy.getCall(0).args[2]).contains(BUILDER_VIEW_TYPE);
  });

  it('sends telemetry and opens text editor when vscode is soql builder mode', async () => {
    sb.stub(vscode.window, 'activeTextEditor').get(() => {
      return undefined;
    });
    await soqlBuilderToggle({} as vscode.Uri);

    expect(telemetryStub.called).is.true;
    expect(executeCommandSpy.getCall(0).args[2]).contains(EDITOR_VIEW_TYPE);
  });
});
