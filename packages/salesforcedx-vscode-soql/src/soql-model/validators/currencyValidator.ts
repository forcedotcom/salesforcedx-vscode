/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Messages } from '../messages/messages';
import { FloatValidator } from './floatValidator';
import { ValidateResult } from './validator';

export class CurrencyValidator extends FloatValidator {
  public validate(input: string): ValidateResult {
    const result = super.validate(input);
    if (result.isValid) {
      return result;
    }

    const isValid = isCurrencyLiteral(input);
    const message = isValid ? undefined : Messages.error_fieldInput_currency;
    return { isValid, message };
  }
}

export function isCurrencyLiteral(s: string): boolean {
  return /^[a-zA-Z]{3}[+-]?[0-9]*[.]?[0-9]+$/.test(s.trim());
}
