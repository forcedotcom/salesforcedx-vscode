/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { messages } from '../../../../src/soql-model/messages/i18n';
import { SObjectFieldType } from '../../../../src/soql-model/model/model';
import { PicklistValidator } from '../../../../src/soql-model/validators/picklistValidator';

describe('PicklistValidator should', () => {
  const options = {
    type: SObjectFieldType.Picklist,
    picklistValues: ["'A'", "'B'"],
  };
  it('return valid result when input is contained in picklist vales', () => {
    const expected = { isValid: true };
    const actual = new PicklistValidator(options).validate("'B'");
    expect(actual).toEqual(expected);
  });
  it('return valid result when picklist vales not defined', () => {
    const expected = { isValid: true };
    const actual = new PicklistValidator({ type: SObjectFieldType.Picklist }).validate("'C'");
    expect(actual).toEqual(expected);
  });
  it('return not valid result when input not contained in picklist values', () => {
    const expected = { isValid: false, message: messages.error_fieldInput_picklist.replace('{0}', "'A', 'B'") };
    const actual = new PicklistValidator(options).validate("'C'");
    expect(actual).toEqual(expected);
  });

  it('return valid for "null" when field is nillable', () => {
    const expected = { isValid: true };
    const actual = new PicklistValidator({ ...options, nillable: true }).validate('null');
    expect(actual).toEqual(expected);
  });

  it('return not valid for "null" when field is NOT nillable', () => {
    const expected = { isValid: false, message: messages.error_fieldInput_picklist.replace('{0}', "'A', 'B'") };
    const actual = new PicklistValidator({ ...options, nillable: false }).validate('null');
    expect(actual).toEqual(expected);
  });
});
