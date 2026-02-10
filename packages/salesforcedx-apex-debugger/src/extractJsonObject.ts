/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
export const extractJsonObject = (str: string): any => {
let stringValue = str;
  if (typeof str !== 'string') {
    stringValue = String(str);
  }

  const jsonString = stringValue.substring(stringValue.indexOf('{'), stringValue.lastIndexOf('}') + 1);

  const result = JSON.parse(jsonString);
  return result;
};
