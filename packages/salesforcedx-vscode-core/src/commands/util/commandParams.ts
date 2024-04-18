/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export type CommandParams = {
  readonly command: string;
  // handle to localized user facing help text, with entries for diff flags
  description: Record<string, string>;
  logName: Record<string, string>; // metric key
};
