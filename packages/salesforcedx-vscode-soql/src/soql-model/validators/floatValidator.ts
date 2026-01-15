/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Messages } from '../messages/messages';
import { ValidateResult, Validator } from './validator';

export class FloatValidator extends Validator {
  public validate(input: string): ValidateResult {
    const isValid = /^[+-]?[0-9]*[.]?[0-9]+$/.test(input.trim());
    const message = isValid ? undefined : Messages.error_fieldInput_float;
    return { isValid, message };
  }
}
