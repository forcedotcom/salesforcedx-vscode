/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ApexCodeCoverage, ApexCodeCoverageAggregate } from '../tests/types';
import * as libCoverage from 'istanbul-lib-coverage';

/** Resolved source supplied by the caller; discovery and reading belong to the host. */
export interface CoverageSource {
  path: string;
  content?: string;
}

const startOfSource = (source: string | undefined): number => (source ? source.search(/\S/) || 0 : 0);
const endOfSource = (source: string | undefined): number => (source ? source.search(/\S$/) || 0 : 0);

export const createCoverageMap = (
  coverage: ApexCodeCoverageAggregate | ApexCodeCoverage,
  sourceForClass: (name: string) => CoverageSource,
  lineEnding = '\n'
): libCoverage.CoverageMap => {
  const coverageMap = libCoverage.createCoverageMap();
  coverage.records.forEach(record => {
    const source = sourceForClass(record.ApexClassOrTrigger.Name);
    const sourceLines = source.content?.replaceAll(/\r\n|\r|\n/g, lineEnding).split(lineEnding) ?? [];
    const coveredLines = record.Coverage?.coveredLines ?? [];
    const uncoveredLines = record.Coverage?.uncoveredLines ?? [];
    coverageMap.addFileCoverage({
      path: source.path,
      fnMap: {},
      branchMap: {},
      f: {},
      b: {},
      s: Object.fromEntries([
        ...coveredLines.map(line => [Number(line).toString(10), 1]),
        ...uncoveredLines.map(line => [Number(line).toString(10), 0])
      ]),
      statementMap: Object.fromEntries(
        [...coveredLines, ...uncoveredLines].sort().map(line => [
          Number(line).toString(10),
          {
            start: { line, column: startOfSource(sourceLines[line - 1]) },
            end: { line, column: endOfSource(sourceLines[line - 1]) }
          }
        ])
      )
    });
  });
  return coverageMap;
};
