/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export type LineBreakpointInfo = {
  uri: string;
  typeref: string;
  lines: number[];
};

export type LineBreakpointsInTyperef = {
  typeref: string;
  lines: number[];
};

export type ApexBreakpointLocation = {
  line: number;
  breakpointId: string;
};
