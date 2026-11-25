/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ReportLineEnding } from '../reporters/lineEnding';

/** Splits text on common newline forms, normalizing to the requested delimiter first. */
export const splitLines = (text: string, lineEnding: ReportLineEnding = '\n'): string[] =>
  text.replaceAll(/\r\n|\r|\n/g, lineEnding).split(lineEnding);
