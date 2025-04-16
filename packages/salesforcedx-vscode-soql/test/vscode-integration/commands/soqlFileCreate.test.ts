/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { SinonSandbox, createSandbox, SinonSpy, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import { soqlOpenNew } from '../../../src/commands/soqlFileCreate';
import { BUILDER_VIEW_TYPE } from '../../../src/constants';
import { telemetryService } from '../../../src/telemetry';

describe('soqlOpenNew should', () => {
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

  it('sends telemetry and opens editor when invoked', async () => {
    await soqlOpenNew();

    expect(telemetryStub.called).is.true;
    expect(executeCommandSpy.getCall(0).args[2]).contains(BUILDER_VIEW_TYPE);
    expect(executeCommandSpy.getCall(0).args[1].scheme).contains('untitled');
  });
});
