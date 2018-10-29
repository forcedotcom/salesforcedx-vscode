/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export class MockJorje {
  constructor() {}
  public getLineBreakpointInfo(): Promise<{}> {
    const response = [
      {
        uri: '/force-app/main/default/classes/A.cls',
        typeref: 'A',
        lines: [2, 5, 6, 7]
      }
    ];
    return Promise.resolve(response);
  }
}
