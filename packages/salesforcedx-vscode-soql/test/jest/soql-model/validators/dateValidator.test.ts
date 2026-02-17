/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { messages } from '../../../../src/soql-model/messages/i18n';
import { SObjectFieldType } from '../../../../src/soql-model/model/model';
import { DateValidator } from '../../../../src/soql-model/validators/dateValidator';

describe('DateValidator should', () => {
  const validator = new DateValidator({ type: SObjectFieldType.Date });
  const validResult = { isValid: true };
  const notValidResult = { isValid: false, message: messages.error_fieldInput_date };
  it('return valid result for date only patterns', () => {
    expect(validator.validate('2020-01-01')).toEqual(validResult);
  });
  it('return valid result for date and time UTC patterns', () => {
    expect(validator.validate('2020-01-01T12:00:00Z')).toEqual(validResult);
  });
  it('return valid result for date and time +- offset patterns', () => {
    expect(validator.validate('2020-01-01T12:00:00+05:00')).toEqual(validResult);
  });
  it('return not valid result for incorrect or incomplete date literal patterns', () => {
    expect(validator.validate('2020-01-01T12:00')).toEqual(notValidResult);
    expect(validator.validate('2020-01-01T12:00:00-5:00')).toEqual(notValidResult);
    expect(validator.validate('202020-01-01T12:00:00-05:00')).toEqual(notValidResult);
  });
  it('return valid result for date range literals', () => {
    expect(validator.validate('tomorrow')).toEqual(validResult);
    expect(validator.validate('last_week')).toEqual(validResult);
  });
  it('return not valid result for incorrect date range literals', () => {
    expect(validator.validate('lastweek')).toEqual(notValidResult);
  });
  it('return true for parameterized date range literals', () => {
    expect(validator.validate('next_n_quarters:5')).toEqual(validResult);
    expect(validator.validate('last_n_weeks:35')).toEqual(validResult);
  });
  it('return not valid result for incorrect parameterized date range literals', () => {
    expect(validator.validate('ast_n_weeks: 35')).toEqual(notValidResult);
    expect(validator.validate('last_n_weeks:')).toEqual(notValidResult);
    expect(validator.validate('last_n_weeks')).toEqual(notValidResult);
  });
});
