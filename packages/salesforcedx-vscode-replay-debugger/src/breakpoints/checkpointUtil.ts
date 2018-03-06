/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export class CheckpointUtil {
  // If the valueInput is a string then add quoutes to both inputs
  // "<nameInput>": "<valueInput>"
  // If the valueInput is a number or boolean then only add quotes to the name
  // "<nameInput>": <valueInput>
  public static formatNameValuePairForJSon(
    nameInput: string,
    valueInput: string | number | boolean
  ): string {
    if (typeof valueInput === 'string') {
      return '"' + nameInput + '": ' + '"' + valueInput + '"';
    }
    // For numbers or booleans, don't quote the value
    return '"' + nameInput + '": ' + valueInput;
  }
}
