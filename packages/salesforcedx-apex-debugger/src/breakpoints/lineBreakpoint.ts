/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export interface LineBreakpointInfo {
  uri: string;
  typeref: string;
  lines: number[];
}

export interface LineBpsInTyperef {
  typeref: string;
  lines: number[];
}

export interface ApexBreakpointLocation {
  line: number;
  breakpointId: string;
}
