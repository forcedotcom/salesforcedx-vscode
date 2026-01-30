/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { messages } from '../../../../src/soql-model/messages/i18n';
import { SObjectFieldType } from '../../../../src/soql-model/model/model';
import { CurrencyValidator } from '../../../../src/soql-model/validators/currencyValidator';

describe('CurrencyValidator should', () => {
  const validator = new CurrencyValidator({ type: SObjectFieldType.Currency });
  const validResult = { isValid: true };
  const notValidResult = { isValid: false, message: messages.error_fieldInput_currency };
  it('return valid result for floating point literals', () => {
    expect(validator.validate('+13.25')).toEqual(validResult);
    expect(validator.validate('-13')).toEqual(validResult);
    expect(validator.validate(' 134501')).toEqual(validResult);
  });
  it('return valid result for correctly formatted currency literals', () => {
    expect(validator.validate('USD+13.25')).toEqual(validResult);
    expect(validator.validate('ABC-13')).toEqual(validResult);
    expect(validator.validate('DEF134501')).toEqual(validResult);
  });
  it('return not valid result for incorrectly formatted currency literals', () => {
    expect(validator.validate('USD 13.25')).toEqual(notValidResult);
    expect(validator.validate('not currency')).toEqual(notValidResult);
  });
});
