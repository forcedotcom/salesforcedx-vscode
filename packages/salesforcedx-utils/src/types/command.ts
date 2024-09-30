/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
export type Command = {
  readonly command: string;
  readonly description?: string;
  readonly args: string[];
  readonly logName?: string;

  toString(): string;
  toCommand(): string;
};
