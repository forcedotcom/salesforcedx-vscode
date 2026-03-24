/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SObjectFieldType } from '../model/model';
import { BooleanValidator } from './booleanValidator';
import { CurrencyValidator } from './currencyValidator';
import { DateValidator } from './dateValidator';
import { FloatValidator } from './floatValidator';
import { IntegerValidator } from './integerValidator';
import { PicklistValidator } from './picklistValidator';
import { StringValidator } from './stringValidator';
import { DefaultValidator, MultipleInputValidator, OperatorValidator, ValidateOptions, Validator } from './validator';

export const getFieldInputValidator = (options: ValidateOptions): Validator => {
  switch (options.type) {
    case SObjectFieldType.Boolean:
      return new BooleanValidator(options);
    case SObjectFieldType.Currency:
      return new CurrencyValidator(options);
    case SObjectFieldType.Date:
    case SObjectFieldType.DateTime:
      return new DateValidator(options);
    case SObjectFieldType.Double:
      return new FloatValidator(options);
    case SObjectFieldType.Integer:
    case SObjectFieldType.Long:
      return new IntegerValidator(options);
    case SObjectFieldType.Picklist:
    case SObjectFieldType.MultiPicklist:
      return new PicklistValidator(options);
    case SObjectFieldType.String:
    case SObjectFieldType.Id:
      return new StringValidator(options);
  }
  return new DefaultValidator(options);
};

export const getOperatorValidator = (options: ValidateOptions): Validator => new OperatorValidator(options);

export const getFieldMultipleInputValidator = (options: ValidateOptions): MultipleInputValidator =>
  new MultipleInputValidator(options, getFieldInputValidator(options));
