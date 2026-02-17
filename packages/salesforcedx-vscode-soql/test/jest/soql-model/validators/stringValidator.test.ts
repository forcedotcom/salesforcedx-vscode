/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { messages } from '../../../../src/soql-model/messages/i18n';
import { SObjectFieldType } from '../../../../src/soql-model/model/model';
import { StringValidator } from '../../../../src/soql-model/validators/stringValidator';

describe('StringValidator should', () => {
  const validator = new StringValidator({ type: SObjectFieldType.String });
  const validResult = { isValid: true };
  const notValidResult = { isValid: false, message: messages.error_fieldInput_string };

  it('return valid result for string in single quotes', () => {
    expect(validator.validate("'foo'")).toEqual(validResult);
  });

  it('return valid result when user input is NULL or null', () => {
    // input of 'null' is not normalized to " 'null' " like other strings
    expect(validator.validate('null')).toEqual(validResult);
    expect(validator.validate('NULL')).toEqual(validResult);
  });

  it('return not valid result for non-string value', () => {
    expect(validator.validate('foo')).toEqual(notValidResult);
  });

  it('return not valid result for string ending in escaped quote', () => {
    expect(validator.validate("'foo\\'")).toEqual(notValidResult);
  });
});
