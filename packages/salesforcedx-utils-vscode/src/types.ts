/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export type DirFileNameSelection = {
  fileName: string;
  outputdir: string;
  template?: 'ApexUnitTest' | 'BasicUnitTest';
  extension?: 'JavaScript' | 'TypeScript';
};
export type LocalComponent = DirFileNameSelection & {
  type: string;
  suffix?: string;
};
