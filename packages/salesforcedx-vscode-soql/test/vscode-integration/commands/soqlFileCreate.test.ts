/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { SinonSandbox, createSandbox, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import { soqlOpenNew } from '../../../src/commands/soqlFileCreate';
import { telemetryService } from '../../../src/telemetry';

describe('soqlOpenNew should', () => {
  let sb: SinonSandbox;
  let telemetryStub: SinonStub;
  let editorOpened: SinonStub;

  beforeEach(() => {
    sb = createSandbox();
    telemetryStub = sb.stub(telemetryService, 'sendCommandEvent');
    editorOpened = sb.stub();
    vscode.workspace.onDidOpenTextDocument(editorOpened);
  });

  afterEach(async () => {
    sb.restore();
  });

  it('sends telemetry and opens editor when invoked', async () => {
    await soqlOpenNew();

    expect(telemetryStub.called).is.true;
    expect(editorOpened.called).is.true;
  });

});