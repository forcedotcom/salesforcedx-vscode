/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
export function splitMultiInputValues(input: string): string[] {
  const values: string[] = [];

  // split at comma; for string input, watch out for commas in quotes
  let isInString = false;
  let currentValue = '';
  let prev = '';
  for (let i = 0; i < input.length; i++) {
    const ch = input.charAt(i);
    switch (ch) {
      case "'": {
        if (isInString) {
          const isEscaped = prev === '\\';
          currentValue += ch;
          if (!isEscaped) {
            isInString = false;
          }
        } else {
          if (currentValue.trim().length === 0) {
            // quote at start of current value
            isInString = true;
          }
          currentValue += ch;
        }
        break;
      }
      case ',': {
        if (isInString) {
          currentValue += ch;
        } else {
          if (currentValue.trim().length > 0) {
            values.push(currentValue.trim());
          }
          currentValue = '';
        }
        break;
      }
      default: {
        currentValue += ch;
        break;
      }
    }
    if (i === input.length - 1 && currentValue.trim().length > 0) {
      values.push(currentValue.trim());
    }
    prev = ch;
  }

  return values;
}
