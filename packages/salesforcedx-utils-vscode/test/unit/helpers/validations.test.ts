/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import {
  isAlphaNumSpaceString,
  isAlphaNumString,
  isInteger,
  isIntegerInRange,
  isRecordIdFormat
} from '../../../src/helpers/validations';

describe('Input Box Validations', () => {
  describe('isInteger', () => {
    it('Should return false if value is undefined', async () => {
      const res = isInteger(undefined);
      expect(res).to.equal(false);
    });

    it('Should return false if value is empty', async () => {
      const res = isInteger('');
      expect(res).to.equal(false);
    });

    it('Should return false if value is a float', async () => {
      const res = isInteger('1.37');
      expect(res).to.equal(false);
    });

    it('Should return false if value is not a number', async () => {
      const res = isInteger('C137');
      expect(res).to.equal(false);
    });

    it('Should return true if value is a valid integer', async () => {
      const res = isInteger('42');
      expect(res).to.equal(true);
    });
  });

  describe('isIntegerInRange', () => {
    it('Should return false if value is undefined', async () => {
      const res = isIntegerInRange(undefined, [1, 3]);
      expect(res).to.equal(false);
    });

    it('Should return false if value is empty', async () => {
      const res = isIntegerInRange('', [1, 3]);
      expect(res).to.equal(false);
    });

    it('Should return false if value is a float', async () => {
      const res = isIntegerInRange('1.37', [1, 3]);
      expect(res).to.equal(false);
    });

    it('Should return false if value is not a number', async () => {
      const res = isIntegerInRange('C137', [1, 3]);
      expect(res).to.equal(false);
    });

    it('Should return false if value is greater than upper limit', async () => {
      const res = isIntegerInRange('4', [1, 3]);
      expect(res).to.equal(false);
    });

    it('Should return false if value is less than lower limit', async () => {
      const res = isIntegerInRange('0', [1, 3]);
      expect(res).to.equal(false);
    });

    it('Should return true if value is a valid integer in range', async () => {
      const res = isIntegerInRange('2', [1, 3]);
      expect(res).to.equal(true);
    });

    it('Should return true if value is equals to lower limit', async () => {
      const res = isIntegerInRange('1', [1, 3]);
      expect(res).to.equal(true);
    });

    it('Should return true if value is equals to upper limit', async () => {
      const res = isIntegerInRange('3', [1, 3]);
      expect(res).to.equal(true);
    });
  });

  describe('isAlphaNumString', () => {
    it('Should return false if value is undefined', async () => {
      const res = isAlphaNumString(undefined);
      expect(res).to.equal(false);
    });

    it('Should return false if value is empty', async () => {
      const res = isAlphaNumString('');
      expect(res).to.equal(false);
    });

    it('Should return false if value contains non alphanumeric characters', async () => {
      const res = isAlphaNumString('my scratch org');
      expect(res).to.equal(false);
    });

    it('Should return true if value has only numeric characters', async () => {
      const res = isAlphaNumString('123');
      expect(res).to.equal(true);
    });

    it('Should return true if value has only alphanumeric characters and underscores', async () => {
      const res = isAlphaNumString('scratch_123');
      expect(res).to.equal(true);
    });
  });

  describe('isAlphaNumSpaceString', () => {
    it('Should return false if value is undefined', async () => {
      const res = isAlphaNumSpaceString(undefined);
      expect(res).to.equal(false);
    });

    it('Should return false if value is empty', async () => {
      const res = isAlphaNumSpaceString('');
      expect(res).to.equal(false);
    });

    it('Should return false if value contains non alphanumeric and space characters', async () => {
      const res = isAlphaNumSpaceString('my-scratch-org!');
      expect(res).to.equal(false);
    });

    it('Should return true if value has only numeric characters', async () => {
      const res = isAlphaNumSpaceString('123');
      expect(res).to.equal(true);
    });

    it('Should return true if value has only underscores, spaces, and alphanumeric characters', async () => {
      const res = isAlphaNumSpaceString('scratch_123 4 5 6');
      expect(res).to.equal(true);
    });
  });

  describe('isRecordIdFormat', () => {
    it('Should return false if value is undefined', async () => {
      const res = isRecordIdFormat(undefined, '123');
      expect(res).to.equal(false);
    });

    it('Should return false if value has incorrect prefix', async () => {
      const res = isRecordIdFormat('153xx0000000123', '123');
      expect(res).to.equal(false);
    });

    it('Should return false if value has incorrect length', async () => {
      const res = isRecordIdFormat('123xx0000000', '123');
      expect(res).to.equal(false);
    });

    it('Should return true if value is a valid record id is 15 chars', async () => {
      const res = isRecordIdFormat('123xx0000000123', '123');
      expect(res).to.equal(true);
    });

    it('Should return true if value is a valid record id is 18 chars', async () => {
      const res = isRecordIdFormat('123xx0000000123Abt', '123');
      expect(res).to.equal(true);
    });
  });
});
