/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Messages } from '../../../../src/soql-model/messages/messages';
import { SObjectFieldType } from '../../../../src/soql-model/model/model';
import { StringValidator } from '../../../../src/soql-model/validators/stringValidator';
import { DefaultValidator, MultipleInputValidator, OperatorValidator } from '../../../../src/soql-model/validators/validator';

describe('DefaultValidator should', () => {
  it('return valid result', () => {
    const expected = { isValid: true };
    const actual = new DefaultValidator({ type: SObjectFieldType.AnyType }).validate('anything');
    expect(actual).toEqual(expected);
  });
});

describe('OperatorValidator should', () => {
  const booleanOperatorValidator = new OperatorValidator({ type: SObjectFieldType.Boolean });
  const currencyOperatorValidator = new OperatorValidator({ type: SObjectFieldType.Currency });
  const dateOperatorValidator = new OperatorValidator({ type: SObjectFieldType.Date });
  const numericOperatorValidator = new OperatorValidator({ type: SObjectFieldType.Long });
  const stringOperatorValidator = new OperatorValidator({ type: SObjectFieldType.String });
  it('return valid result for accepted operator', () => {
    const expected = { isValid: true };
    expect(booleanOperatorValidator.validate('eq')).toEqual(expected);
    expect(currencyOperatorValidator.validate('eq')).toEqual(expected);
    expect(dateOperatorValidator.validate('eq')).toEqual(expected);
    expect(numericOperatorValidator.validate('eq')).toEqual(expected);
    expect(stringOperatorValidator.validate('eq')).toEqual(expected);
  });
  it('return not valid result for not accepted operator', () => {
    const expected = { isValid: false, message: Messages.error_operatorInput.replace('{0}', 'LIKE') };
    expect(booleanOperatorValidator.validate('like')).toEqual(expected);
    expect(currencyOperatorValidator.validate('like')).toEqual(expected);
    expect(dateOperatorValidator.validate('like')).toEqual(expected);
    expect(numericOperatorValidator.validate('like')).toEqual(expected);
  });
  it('return not valid result for unrecognized operator', () => {
    const expected = { isValid: false, message: Messages.error_operatorInput.replace('{0}', 'unrecognized') };
    expect(booleanOperatorValidator.validate('unrecognized')).toEqual(expected);
    expect(currencyOperatorValidator.validate('unrecognized')).toEqual(expected);
    expect(dateOperatorValidator.validate('unrecognized')).toEqual(expected);
    expect(numericOperatorValidator.validate('unrecognized')).toEqual(expected);
    expect(stringOperatorValidator.validate('unrecognized')).toEqual(expected);
  });
});

describe('MultipleInputValidator should', () => {
  const stringOptions = { type: SObjectFieldType.String };
  const validator = new MultipleInputValidator(stringOptions, new StringValidator(stringOptions));
  it('return not valid result for empty input', () => {
    const notValidResult = { isValid: false, message: Messages.error_fieldInput_list };
    expect(validator.validate('')).toEqual(notValidResult);
    expect(validator.validate('  ')).toEqual(notValidResult);
    expect(validator.validate(' , ,, ')).toEqual(notValidResult);
  });
  it('return not valid result for invalid input for type', () => {
    const notValidResult = { isValid: false, message: Messages.error_fieldInput_string };
    expect(validator.validate("'good', bad")).toEqual(notValidResult);
  });
  it('return valid result for input that is valid as determined by delegate validator', () => {
    const validResult = { isValid: true };
    expect(validator.validate("'good', 'also good'")).toEqual(validResult);
  });
});
