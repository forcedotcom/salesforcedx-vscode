/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export interface LineBreakpointInfo {
  uri: string;
  typeref: string;
  lines: number[];
}
export { BreakpointUtil } from './breakpointUtil';
import { BreakpointUtil } from './breakpointUtil';
export const breakpointUtil = BreakpointUtil.getInstance();

export interface LineBreakpointEventArgs {
  lineBreakpointInfo: LineBreakpointInfo[];
  projectPath: string | undefined;
}
