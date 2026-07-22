/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export type HeapDumpLogEntry = {
  heapDumpId: string;
  className: string;
  namespace: string;
  line: number;
};

const HEAP_DUMP_REGEX = /\|HEAP_DUMP\|/;

/** Pure scan of log lines for HEAP_DUMP entries. No session/state. splitLine[3..6] = id/class/ns/line. */
export const extractHeapDumpIdsFromLog = (logLines: string[]): HeapDumpLogEntry[] =>
  logLines
    .filter(line => HEAP_DUMP_REGEX.test(line))
    .map(line => line.split('|'))
    .filter(splitLine => splitLine.length >= 7)
    .map(splitLine => ({
      heapDumpId: splitLine[3],
      className: splitLine[4],
      namespace: splitLine[5],
      line: Number(splitLine[6])
    }));
