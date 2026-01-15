/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Messages } from '../messages/messages';
import { ValidateResult, Validator } from './validator';

export class StringValidator extends Validator {
  public validate(input: string): ValidateResult {
    const isValid =
      (input.length >= 2 &&
        input.startsWith("'") &&
        input.endsWith("'") &&
        !this.isEscaped(input.substring(1, input.length - 1))) ||
      input.toLowerCase() === 'null';
    const message = isValid ? undefined : Messages.error_fieldInput_string;
    return { isValid, message };
  }

  protected isEscaped(input: string): boolean {
    // test to see whether trailing single quote is escaped
    let isEscaped = false;
    for (let i = 0; i < input.length; i++) {
      const ch = input.charAt(i);
      if (isEscaped) {
        isEscaped = false;
      } else if (ch === '\\') {
        isEscaped = true;
      }
    }
    return isEscaped;
  }
}
