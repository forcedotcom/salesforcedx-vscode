/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { createSandbox, SinonSandbox, SinonSpy, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import { BUILDER_VIEW_TYPE, soqlOpenNew, telemetryService } from '../../../src';

describe('soqlOpenNew should', () => {
  let sb: SinonSandbox;
  let telemetryStub: SinonStub;
  let editorOpened: SinonStub;
  let executeCommandSpy: SinonSpy;

  beforeEach(() => {
    sb = createSandbox();
    telemetryStub = sb.stub(telemetryService, 'sendCommandEvent') as SinonStub;
    editorOpened = sb.stub();
    vscode.workspace.onDidOpenTextDocument(editorOpened);
    executeCommandSpy = (sb.spy(
      vscode.commands,
      'executeCommand'
    ) as unknown) as SinonSpy;
  });

  afterEach(async () => {
    sb.restore();
  });

  it('sends telemetry and opens editor when invoked', async () => {
    await soqlOpenNew();

    expect(telemetryStub.called).is.true;
    expect(editorOpened.called).is.true;
    expect(executeCommandSpy.getCall(0).args[2]).contains(BUILDER_VIEW_TYPE);
  });
});
