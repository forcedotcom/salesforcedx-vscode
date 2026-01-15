/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Messages } from '../../../../src/soql-model/messages/messages';
import { SObjectFieldType } from '../../../../src/soql-model/model/model';
import { BooleanValidator } from '../../../../src/soql-model/validators/booleanValidator';

describe('BooleanValidator should', () => {
  const validator = new BooleanValidator({ type: SObjectFieldType.Boolean });
  const validResult = { isValid: true };
  const notValidResult = { isValid: false, message: Messages.error_fieldInput_boolean };
  it('return valid result for TRUE or FALSE', () => {
    expect(validator.validate(' true')).toEqual(validResult);
    expect(validator.validate('false ')).toEqual(validResult);
  });
  it('return not valid result for non-boolean value', () => {
    expect(validator.validate('not boolean')).toEqual(notValidResult);
  });
});
