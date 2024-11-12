/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { assert, expect } from 'chai';
import { stub } from 'sinon';
import * as vscode from 'vscode';
import { InputUtils } from '../../../src/util/inputUtils';

describe('inputUtils Unit tests', () => {
  describe('getFormattedString', () => {
    let showInputBoxStub: sinon.SinonStub;
    const INPUT_VAL = 'Test Input';
    const EMPTY_STRING = '';
    const WHITESPACE = '   ';

    beforeEach(() => {
      showInputBoxStub = stub(vscode.window, 'showInputBox');
    });

    afterEach(() => {
      showInputBoxStub.restore();
    });

    it('should call showInputBox once', async () => {
      showInputBoxStub.resolves(INPUT_VAL);
      const trimmedString = await InputUtils.getFormattedString('', '');
      assert(showInputBoxStub.calledOnce);
    });

    it('should remove leading whitespace', async () => {
      showInputBoxStub.resolves(`  ${INPUT_VAL}`);
      const trimmedString = await InputUtils.getFormattedString('', '');
      expect(trimmedString).to.be.eq(INPUT_VAL);
    });

    it('should remove trailing whitespace', async () => {
      showInputBoxStub.resolves(`${INPUT_VAL}  `);
      const trimmedString = await InputUtils.getFormattedString('', '');
      expect(trimmedString).to.be.eq(INPUT_VAL);
    });

    it('should remove leading and trailing whitespace', async () => {
      showInputBoxStub.resolves(`  ${INPUT_VAL}  `);
      const trimmedString = await InputUtils.getFormattedString('', '');
      expect(trimmedString).to.be.eq(INPUT_VAL);
    });

    it('should return an empty string when given an empty string', async () => {
      showInputBoxStub.resolves(EMPTY_STRING);
      const trimmedString = await InputUtils.getFormattedString('', '');
      expect(trimmedString).to.be.eq(EMPTY_STRING);
    });

    it('should return empty string when given whitespace', async () => {
      showInputBoxStub.resolves(WHITESPACE);
      const trimmedString = await InputUtils.getFormattedString('', '');
      expect(trimmedString).to.be.eq(EMPTY_STRING);
    });

    it('should return undefined when given undefined', async () => {
      showInputBoxStub.resolves(undefined);
      const trimmedString = await InputUtils.getFormattedString('', '');
      assert.isUndefined(trimmedString);
    });

    it('should return null when given null', async () => {
      showInputBoxStub.resolves(null);
      const trimmedString = await InputUtils.getFormattedString('', '');
      assert.isNull(trimmedString);
    });
  });
});
