/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export function isNullOrUndefined(object: any): object is null | undefined {
  if (object === null || object === undefined) {
    return true;
  } else {
    return false;
  }
}

export function extractJsonObject(str: string): any {

  const jsonString = str.substring(
    str.indexOf('{'),
    str.lastIndexOf('}') + 1
  );

  return JSON.parse(jsonString);
}
