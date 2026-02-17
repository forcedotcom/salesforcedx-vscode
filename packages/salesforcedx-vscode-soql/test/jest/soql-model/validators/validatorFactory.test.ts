/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SObjectFieldType } from '../../../../src/soql-model/model/model';
import { ValidatorFactory } from '../../../../src/soql-model/validators/validatorFactory';

describe('ValidatorFactory should', () => {
  it('return validators based on field type', () => {
    const options = [
      { type: SObjectFieldType.Address },
      { type: SObjectFieldType.AnyType },
      { type: SObjectFieldType.Base64 },
      { type: SObjectFieldType.Boolean },
      { type: SObjectFieldType.Combobox },
      { type: SObjectFieldType.ComplexValue },
      { type: SObjectFieldType.Currency },
      { type: SObjectFieldType.Date },
      { type: SObjectFieldType.DateTime },
      { type: SObjectFieldType.Double },
      { type: SObjectFieldType.Email },
      { type: SObjectFieldType.EncryptedString },
      { type: SObjectFieldType.Id },
      { type: SObjectFieldType.Integer },
      { type: SObjectFieldType.Location },
      { type: SObjectFieldType.Long },
      { type: SObjectFieldType.MultiPicklist },
      { type: SObjectFieldType.Percent },
      { type: SObjectFieldType.Phone },
      { type: SObjectFieldType.Picklist },
      { type: SObjectFieldType.Reference },
      { type: SObjectFieldType.String },
      { type: SObjectFieldType.TextArea },
      { type: SObjectFieldType.Time },
      { type: SObjectFieldType.Url },
    ];
    const expected = [
      'DefaultValidator',
      'DefaultValidator',
      'DefaultValidator',
      'BooleanValidator',
      'DefaultValidator',
      'DefaultValidator',
      'CurrencyValidator',
      'DateValidator',
      'DateValidator',
      'FloatValidator',
      'DefaultValidator',
      'DefaultValidator',
      'StringValidator',
      'IntegerValidator',
      'DefaultValidator',
      'IntegerValidator',
      'PicklistValidator',
      'DefaultValidator',
      'DefaultValidator',
      'PicklistValidator',
      'DefaultValidator',
      'StringValidator',
      'DefaultValidator',
      'DefaultValidator',
      'DefaultValidator',
    ];

    const actual = options.map((option) => ValidatorFactory.getFieldInputValidator(option).constructor.name);
    expect(actual).toEqual(expected);
  });
  it('return operator validator OperatorValidator regardless of field type', () => {
    const options = [
      { type: SObjectFieldType.Address },
      { type: SObjectFieldType.AnyType },
      { type: SObjectFieldType.Base64 },
      { type: SObjectFieldType.Boolean },
      { type: SObjectFieldType.Combobox },
      { type: SObjectFieldType.ComplexValue },
      { type: SObjectFieldType.Currency },
      { type: SObjectFieldType.Date },
      { type: SObjectFieldType.DateTime },
      { type: SObjectFieldType.Double },
      { type: SObjectFieldType.Email },
      { type: SObjectFieldType.EncryptedString },
      { type: SObjectFieldType.Id },
      { type: SObjectFieldType.Integer },
      { type: SObjectFieldType.Location },
      { type: SObjectFieldType.Long },
      { type: SObjectFieldType.MultiPicklist },
      { type: SObjectFieldType.Percent },
      { type: SObjectFieldType.Phone },
      { type: SObjectFieldType.Picklist },
      { type: SObjectFieldType.Reference },
      { type: SObjectFieldType.String },
      { type: SObjectFieldType.TextArea },
      { type: SObjectFieldType.Time },
      { type: SObjectFieldType.Url },
    ];
    const expected = [
      'OperatorValidator',
      'OperatorValidator',
      'OperatorValidator',
      'OperatorValidator',
      'OperatorValidator',
      'OperatorValidator',
      'OperatorValidator',
      'OperatorValidator',
      'OperatorValidator',
      'OperatorValidator',
      'OperatorValidator',
      'OperatorValidator',
      'OperatorValidator',
      'OperatorValidator',
      'OperatorValidator',
      'OperatorValidator',
      'OperatorValidator',
      'OperatorValidator',
      'OperatorValidator',
      'OperatorValidator',
      'OperatorValidator',
      'OperatorValidator',
      'OperatorValidator',
      'OperatorValidator',
      'OperatorValidator',
    ];

    const actual = options.map((option) => ValidatorFactory.getOperatorValidator(option).constructor.name);
    expect(actual).toEqual(expected);
  });

  it('return multi-input validator MultipleInputValidator regardless of field type', () => {
    const options = [
      { type: SObjectFieldType.Address },
      { type: SObjectFieldType.AnyType },
      { type: SObjectFieldType.Base64 },
      { type: SObjectFieldType.Boolean },
      { type: SObjectFieldType.Combobox },
      { type: SObjectFieldType.ComplexValue },
      { type: SObjectFieldType.Currency },
      { type: SObjectFieldType.Date },
      { type: SObjectFieldType.DateTime },
      { type: SObjectFieldType.Double },
      { type: SObjectFieldType.Email },
      { type: SObjectFieldType.EncryptedString },
      { type: SObjectFieldType.Id },
      { type: SObjectFieldType.Integer },
      { type: SObjectFieldType.Location },
      { type: SObjectFieldType.Long },
      { type: SObjectFieldType.MultiPicklist },
      { type: SObjectFieldType.Percent },
      { type: SObjectFieldType.Phone },
      { type: SObjectFieldType.Picklist },
      { type: SObjectFieldType.Reference },
      { type: SObjectFieldType.String },
      { type: SObjectFieldType.TextArea },
      { type: SObjectFieldType.Time },
      { type: SObjectFieldType.Url },
    ];
    const expected = [
      'MultipleInputValidator',
      'MultipleInputValidator',
      'MultipleInputValidator',
      'MultipleInputValidator',
      'MultipleInputValidator',
      'MultipleInputValidator',
      'MultipleInputValidator',
      'MultipleInputValidator',
      'MultipleInputValidator',
      'MultipleInputValidator',
      'MultipleInputValidator',
      'MultipleInputValidator',
      'MultipleInputValidator',
      'MultipleInputValidator',
      'MultipleInputValidator',
      'MultipleInputValidator',
      'MultipleInputValidator',
      'MultipleInputValidator',
      'MultipleInputValidator',
      'MultipleInputValidator',
      'MultipleInputValidator',
      'MultipleInputValidator',
      'MultipleInputValidator',
      'MultipleInputValidator',
      'MultipleInputValidator',
    ];

    const actual = options.map((option) => ValidatorFactory.getFieldMultipleInputValidator(option).constructor.name);
    expect(actual).toEqual(expected);
  });
});
