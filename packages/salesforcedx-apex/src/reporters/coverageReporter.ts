/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import * as glob from 'fast-glob';
import * as libReport from 'istanbul-lib-report';
import * as reports from 'istanbul-reports';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { generateCoverageReports, IstanbulReports } from '../effect/coverageReports';
import { ApexReportError, causeMessage, runReportSync } from '../effect/errors';
import { type ApexCodeCoverage, type ApexCodeCoverageAggregate } from '../effect/schema/wire/coverage';
import { nls } from '../i18n';
import { type CoverageSource } from './coverageMap';
import { type CoverageReporterOptions } from './coverageOptions';

const resolveSources = (
  coverage: ApexCodeCoverageAggregate | ApexCodeCoverage,
  sourceDir: string
): Readonly<Record<string, CoverageSource>> => {
  const pathsToFiles = glob.sync('**/*.{cls,trigger}', { cwd: sourceDir });
  return Object.fromEntries(
    coverage.records.map(record => {
      const name = record.ApexClassOrTrigger.Name;
      const fileRegEx = new RegExp(`${name}.(cls|trigger)`);
      const sourcePath = path.join(sourceDir, pathsToFiles.find(file => fileRegEx.test(file)) || name);
      try {
        return [name, { path: sourcePath, content: fs.readFileSync(sourcePath, 'utf8') }];
      } catch {
        // Preserve legacy source-less reports; Istanbul HTML requires a string from its source finder.
        return [name, { path: sourcePath, content: '' }];
      }
    })
  );
};

/** Compatibility adapter; report generation and Istanbul formatting live in the Effect API. */
export class CoverageReporter {
  constructor(
    private readonly coverage: ApexCodeCoverageAggregate | ApexCodeCoverage,
    private readonly reportDir: string,
    private readonly sourceDir: string,
    private readonly options?: CoverageReporterOptions
  ) {}

  public generateReports(): void {
    try {
      fs.statSync(this.reportDir);
      runReportSync(
        generateCoverageReports(this.coverage, resolveSources(this.coverage, this.sourceDir), {
          ...this.options,
          lineEnding: os.EOL === '\r\n' ? '\r\n' : '\n'
        }).pipe(
          Effect.provideService(IstanbulReports, {
            createContext: options => libReport.createContext({ ...options, dir: this.reportDir }),
            createReport: reports.create
          })
        )
      );
    } catch (cause) {
      throw new Error(
        Schema.is(ApexReportError)(cause)
          ? cause.message
          : nls.localize('coverageReportCreationError', causeMessage(cause))
      );
    }
  }
}
