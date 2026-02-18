/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { messages } from '../messages/i18n';
import { ValidateResult, Validator } from './validator';

export class BooleanValidator extends Validator {
  public validate(input: string): ValidateResult {
    const isValid = input.trim().toLowerCase() === 'true' || input.trim().toLowerCase() === 'false';
    const message = isValid ? undefined : messages.error_fieldInput_boolean;
    return { isValid, message };
  }
}
