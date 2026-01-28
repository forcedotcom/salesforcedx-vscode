/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { messages } from '../messages/i18n';
import { SObjectFieldType, UiOperatorValue } from '../model/model';
import { splitMultiInputValues } from './inputUtils';

export interface ValidateOptions {
  type: SObjectFieldType;
  nillable?: boolean;
  picklistValues?: string[];
}

export interface ValidateResult {
  isValid: boolean;
  message?: string;
}

export abstract class Validator {
  constructor(protected options: ValidateOptions) {}
  public abstract validate(input: string): ValidateResult;
}

export class DefaultValidator extends Validator {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public validate(input: string): ValidateResult {
    return { isValid: true };
  }
}
interface Operator {
  description: UiOperatorValue;
  display: string;
  types: string[];
}
// prettier-ignore
const LIKE_TYPES = [SObjectFieldType.Address, SObjectFieldType.AnyType, SObjectFieldType.Combobox, SObjectFieldType.ComplexValue, SObjectFieldType.Email, SObjectFieldType.EncryptedString, SObjectFieldType.Id, SObjectFieldType.Location, SObjectFieldType.MultiPicklist, SObjectFieldType.Phone, SObjectFieldType.Picklist, SObjectFieldType.Reference, SObjectFieldType.String, SObjectFieldType.TextArea, SObjectFieldType.Url];
// prettier-ignore
const allOperators: Operator[] = [
  { description: 'EQ', display: '=', types: [SObjectFieldType.Address, SObjectFieldType.AnyType, SObjectFieldType.Base64, SObjectFieldType.Boolean, SObjectFieldType.Combobox, SObjectFieldType.ComplexValue, SObjectFieldType.Currency, SObjectFieldType.Date, SObjectFieldType.DateTime, SObjectFieldType.Double, SObjectFieldType.Email, SObjectFieldType.EncryptedString, SObjectFieldType.Id, SObjectFieldType.Integer, SObjectFieldType.Location, SObjectFieldType.Long, SObjectFieldType.MultiPicklist, SObjectFieldType.Percent, SObjectFieldType.Phone, SObjectFieldType.Picklist, SObjectFieldType.Reference, SObjectFieldType.String, SObjectFieldType.TextArea, SObjectFieldType.Time, SObjectFieldType.Url] },
  { description: 'NOT_EQ', display: '!=', types: [SObjectFieldType.Address, SObjectFieldType.AnyType, SObjectFieldType.Base64, SObjectFieldType.Boolean, SObjectFieldType.Combobox, SObjectFieldType.ComplexValue, SObjectFieldType.Currency, SObjectFieldType.Date, SObjectFieldType.DateTime, SObjectFieldType.Double, SObjectFieldType.Email, SObjectFieldType.EncryptedString, SObjectFieldType.Id, SObjectFieldType.Integer, SObjectFieldType.Location, SObjectFieldType.Long, SObjectFieldType.MultiPicklist, SObjectFieldType.Percent, SObjectFieldType.Phone, SObjectFieldType.Picklist, SObjectFieldType.Reference, SObjectFieldType.String, SObjectFieldType.TextArea, SObjectFieldType.Time, SObjectFieldType.Url] },
  { description: 'ALT_NOT_EQ', display: '<>', types: [SObjectFieldType.Address, SObjectFieldType.AnyType, SObjectFieldType.Base64, SObjectFieldType.Boolean, SObjectFieldType.Combobox, SObjectFieldType.ComplexValue, SObjectFieldType.Currency, SObjectFieldType.Date, SObjectFieldType.DateTime, SObjectFieldType.Double, SObjectFieldType.Email, SObjectFieldType.EncryptedString, SObjectFieldType.Id, SObjectFieldType.Integer, SObjectFieldType.Location, SObjectFieldType.Long, SObjectFieldType.MultiPicklist, SObjectFieldType.Percent, SObjectFieldType.Phone, SObjectFieldType.Picklist, SObjectFieldType.Reference, SObjectFieldType.String, SObjectFieldType.TextArea, SObjectFieldType.Time, SObjectFieldType.Url] },
  { description: 'LT_EQ', display: '<=', types: [SObjectFieldType.Address, SObjectFieldType.AnyType, SObjectFieldType.Base64, SObjectFieldType.Combobox, SObjectFieldType.ComplexValue, SObjectFieldType.Currency, SObjectFieldType.Date, SObjectFieldType.DateTime, SObjectFieldType.Double, SObjectFieldType.Email, SObjectFieldType.EncryptedString, SObjectFieldType.Id, SObjectFieldType.Integer, SObjectFieldType.Location, SObjectFieldType.Long, SObjectFieldType.MultiPicklist, SObjectFieldType.Percent, SObjectFieldType.Phone, SObjectFieldType.Picklist, SObjectFieldType.Reference, SObjectFieldType.String, SObjectFieldType.TextArea, SObjectFieldType.Time, SObjectFieldType.Url] },
  { description: 'GT_EQ', display: '>=', types: [SObjectFieldType.Address, SObjectFieldType.AnyType, SObjectFieldType.Base64, SObjectFieldType.Combobox, SObjectFieldType.ComplexValue, SObjectFieldType.Currency, SObjectFieldType.Date, SObjectFieldType.DateTime, SObjectFieldType.Double, SObjectFieldType.Email, SObjectFieldType.EncryptedString, SObjectFieldType.Id, SObjectFieldType.Integer, SObjectFieldType.Location, SObjectFieldType.Long, SObjectFieldType.MultiPicklist, SObjectFieldType.Percent, SObjectFieldType.Phone, SObjectFieldType.Picklist, SObjectFieldType.Reference, SObjectFieldType.String, SObjectFieldType.TextArea, SObjectFieldType.Time, SObjectFieldType.Url] },
  { description: 'LT', display: '<', types: [SObjectFieldType.Address, SObjectFieldType.AnyType, SObjectFieldType.Base64, SObjectFieldType.Combobox, SObjectFieldType.ComplexValue, SObjectFieldType.Currency, SObjectFieldType.Date, SObjectFieldType.DateTime, SObjectFieldType.Double, SObjectFieldType.Email, SObjectFieldType.EncryptedString, SObjectFieldType.Id, SObjectFieldType.Integer, SObjectFieldType.Location, SObjectFieldType.Long, SObjectFieldType.MultiPicklist, SObjectFieldType.Percent, SObjectFieldType.Phone, SObjectFieldType.Picklist, SObjectFieldType.Reference, SObjectFieldType.String, SObjectFieldType.TextArea, SObjectFieldType.Time, SObjectFieldType.Url] },
  { description: 'GT', display: '>', types: [SObjectFieldType.Address, SObjectFieldType.AnyType, SObjectFieldType.Base64, SObjectFieldType.Combobox, SObjectFieldType.ComplexValue, SObjectFieldType.Currency, SObjectFieldType.Date, SObjectFieldType.DateTime, SObjectFieldType.Double, SObjectFieldType.Email, SObjectFieldType.EncryptedString, SObjectFieldType.Id, SObjectFieldType.Integer, SObjectFieldType.Location, SObjectFieldType.Long, SObjectFieldType.MultiPicklist, SObjectFieldType.Percent, SObjectFieldType.Phone, SObjectFieldType.Picklist, SObjectFieldType.Reference, SObjectFieldType.String, SObjectFieldType.TextArea, SObjectFieldType.Time, SObjectFieldType.Url] },
  { description: 'LIKE', display: 'LIKE', types: LIKE_TYPES },
  { description: 'LIKE_START', display: 'LIKE', types: LIKE_TYPES },
  { description: 'LIKE_END', display: 'LIKE', types: LIKE_TYPES },
  { description: 'LIKE_CONTAINS', display: 'LIKE', types: LIKE_TYPES },
  { description: 'IN', display: 'IN', types: [SObjectFieldType.Address, SObjectFieldType.AnyType, SObjectFieldType.Base64, SObjectFieldType.Boolean, SObjectFieldType.Combobox, SObjectFieldType.ComplexValue, SObjectFieldType.Currency, SObjectFieldType.Date, SObjectFieldType.DateTime, SObjectFieldType.Double, SObjectFieldType.Email, SObjectFieldType.EncryptedString, SObjectFieldType.Id, SObjectFieldType.Integer, SObjectFieldType.Location, SObjectFieldType.Long, SObjectFieldType.MultiPicklist, SObjectFieldType.Percent, SObjectFieldType.Phone, SObjectFieldType.Picklist, SObjectFieldType.Reference, SObjectFieldType.String, SObjectFieldType.TextArea, SObjectFieldType.Time, SObjectFieldType.Url] },
  { description: 'NOT_IN', display: 'NOT IN', types: [SObjectFieldType.Address, SObjectFieldType.AnyType, SObjectFieldType.Base64, SObjectFieldType.Boolean, SObjectFieldType.Combobox, SObjectFieldType.ComplexValue, SObjectFieldType.Currency, SObjectFieldType.Date, SObjectFieldType.DateTime, SObjectFieldType.Double, SObjectFieldType.Email, SObjectFieldType.EncryptedString, SObjectFieldType.Id, SObjectFieldType.Integer, SObjectFieldType.Location, SObjectFieldType.Long, SObjectFieldType.MultiPicklist, SObjectFieldType.Percent, SObjectFieldType.Phone, SObjectFieldType.Picklist, SObjectFieldType.Reference, SObjectFieldType.String, SObjectFieldType.TextArea, SObjectFieldType.Time, SObjectFieldType.Url] },
  { description: 'INCLUDES', display: 'INCLUDES', types: [SObjectFieldType.MultiPicklist] },
  { description: 'EXCLUDES', display: 'EXCLUDES', types: [SObjectFieldType.MultiPicklist] }
];

export class OperatorValidator extends Validator {
  public validate(input: string): ValidateResult {
    const operator = allOperators.find((op) => op.description === input.toUpperCase().trim());
    const display = operator ? operator.display : input;
    const isValid = operator ? operator.types.includes(this.options.type) : false;
    const message = isValid ? undefined : messages.error_operatorInput.replace('{0}', display);
    return { isValid, message };
  }
}

export class MultipleInputValidator extends Validator {
  constructor(protected options: ValidateOptions, protected delegateValidator: Validator) {
    super(options);
  }
  public validate(input: string): ValidateResult {
    const values = splitMultiInputValues(input);
    if (values.length > 0) {
      for (const value of values) {
        const result = this.delegateValidator.validate(value);
        if (!result.isValid) {
          return result;
        }
      }
    } else {
      return {
        isValid: false,
        message: messages.error_fieldInput_list,
      };
    }
    return { isValid: true };
  }
}
