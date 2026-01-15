/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Messages } from '../messages/messages';
import { ValidateResult, Validator } from './validator';

export class PicklistValidator extends Validator {
  public validate(input: string): ValidateResult {
    let isValid = true;
    let message;
    if (this.options.picklistValues) {
      const validValues = [...this.options.picklistValues];
      if (this.options.nillable) {
        validValues.push('null');
      }
      isValid = validValues.includes(input);
      if (!isValid) {
        const commaSeparatedValues = validValues.reduce((soFar, next) => {
          // eslint-disable-next-line no-param-reassign
          if (soFar.length > 0) {
            // eslint-disable-next-line no-param-reassign
            soFar += ', ';
          }
          // eslint-disable-next-line no-param-reassign
          soFar += next;
          return soFar;
        });
        message = Messages.error_fieldInput_picklist.replace('{0}', commaSeparatedValues);
      }
    }
    return { isValid, message };
  }
}
