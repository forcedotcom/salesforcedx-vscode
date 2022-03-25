/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { createSandbox, SinonSandbox } from 'sinon';
import * as vscode from 'vscode';
import { getTrimmedString } from '../../../src/util/inputUtils';

describe('getTrimmedString', () => {
  let sandbox: SinonSandbox;
  const inputString = 'Test Input';

  beforeEach(() => {
    sandbox = createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should call showInputBox once', async () => {
    const inputBox = sandbox.stub(vscode.window, 'showInputBox').resolves(inputString);
    const trimmedString = await getTrimmedString({});
    sandbox.assert.calledOnce(inputBox);
  });

  it('should remove leading whitespace', async () => {
    sandbox.stub(vscode.window, 'showInputBox').resolves(`  ${inputString}`);
    const trimmedString = await getTrimmedString({});
    expect(trimmedString).to.be.eq(inputString);
  });

  it('should remove trailing whitespace', async () => {
    sandbox.stub(vscode.window, 'showInputBox').resolves(`${inputString}  `);
    const trimmedString = await getTrimmedString({});
    expect(trimmedString).to.be.eq(inputString);
  });

  it('should remove leading and trailing whitespace', async () => {
    sandbox.stub(vscode.window, 'showInputBox').resolves(`  ${inputString}  `);
    const trimmedString = await getTrimmedString({});
    expect(trimmedString).to.be.eq(inputString);
  });
});
