/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { ApexCodeCoverage, ApexCodeCoverageAggregate } from '../tests/types';
import * as glob from 'fast-glob';
import type * as libCoverage from 'istanbul-lib-coverage';
import * as libReport from 'istanbul-lib-report';
import * as reports from 'istanbul-reports';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { nls } from '../i18n';
import { elapsedTime } from '../utils';
import { createCoverageMap } from './coverageMap';
import { DefaultReportOptions, DefaultWatermarks, type CoverageReporterOptions } from './coverageOptions';

export { DefaultReportOptions, DefaultWatermarks } from './coverageOptions';
export type { CoverageReportFormats, CoverageReporterOptions } from './coverageOptions';

/** Utility class to produce various well-known code coverage reports from Apex test coverage results. */
export class CoverageReporter {
  /**
   * @param coverage - instance of either an ApexCodeCoverageAggregate or ApexCodeCoverage object
   * @param reportDir - Directory to where the requested coverage reports will be written
   * @param sourceDir - Source directory for those Apex classes or triggers included in coverage data
   * @param options - CoverageReporterOptions
   */
  constructor(
    private readonly coverage: ApexCodeCoverageAggregate | ApexCodeCoverage,
    private readonly reportDir: string,
    private readonly sourceDir: string,
    private readonly options?: CoverageReporterOptions
  ) {}

  @elapsedTime()
  public generateReports(): void {
    try {
      const coverageMap = this.buildCoverageMap();
      fs.statSync(this.reportDir);
      const context = libReport.createContext({
        dir: this.reportDir,
        defaultSummarizer: 'nested',
        watermarks: this.options?.watermark || DefaultWatermarks,
        coverageMap
      });
      const formats = this.options?.reportFormats || ['text-summary'];
      formats.forEach(format => {
        reports.create(format, this.options?.reportOptions?.[format] || DefaultReportOptions[format]).execute(context);
      });
    } catch (e) {
      throw new Error(nls.localize('coverageReportCreationError', e.message));
    }
  }

  @elapsedTime()
  private buildCoverageMap(): libCoverage.CoverageMap {
    const pathsToFiles = this.findFullPathToClass(['cls', 'trigger']);
    return createCoverageMap(
      this.coverage,
      name => {
        const fileRegEx = new RegExp(`${name}.(cls|trigger)`);
        const sourcePath = path.join(this.sourceDir, pathsToFiles.find(file => fileRegEx.test(file)) || name);
        try {
          return { path: sourcePath, content: fs.readFileSync(sourcePath, 'utf8') };
        } catch {
          // File not found: retain coverage even when source is unavailable.
          return { path: sourcePath };
        }
      },
      os.EOL
    );
  }

  @elapsedTime()
  private findFullPathToClass(listOfExtensions: string[]): string[] {
    return glob.sync(`**/*.{${listOfExtensions.join(',')}}`, { cwd: this.sourceDir });
  }
}
