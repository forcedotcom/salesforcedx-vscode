/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { ReportLineEnding } from './lineEnding.js';
import { type ApexTestResultData } from '../tests/apiTypes.js';
import { splitLines } from '../utils/splitLines.js';
/**
 * this regex is flagged as likely incorrect by Cursor, BUT there is a unit test that specs
 * expect(result[12].diagnostics).to.eql([
      'Weird characters <>&"\'',
      'Surrounded by newlines.',
      'and whitespace.'
    ]);
    so it has been left as is
 */
const startsWithNewlineRegex = new RegExp(/^[/\r\n|\r|\n][\w]*/gim);

export const buildTapDiagnostics = (testResult: ApexTestResultData, lineEnding: ReportLineEnding = '\n'): string[] => {
  if (testResult.outcome === 'Pass') {
    return [];
  }

  const message = testResult.message
    ? startsWithNewlineRegex.test(testResult.message)
      ? splitLines(testResult.message)
          .filter(msg => msg?.length > 0)
          .map(msg => msg.trim())
      : [testResult.message]
    : ['Unknown error'];

  const stack = testResult.stackTrace ? splitLines(testResult.stackTrace, lineEnding) : [];
  return [...message, ...stack];
};
