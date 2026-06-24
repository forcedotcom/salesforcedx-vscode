/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as glob from 'fast-glob';
import * as libCoverage from 'istanbul-lib-coverage';
import * as libReport from 'istanbul-lib-report';
import * as reports from 'istanbul-reports';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { nls } from '../i18n';
import {
  ApexCodeCoverage,
  ApexCodeCoverageAggregate,
  ApexCodeCoverageAggregateRecord,
  ApexCodeCoverageRecord
} from '../tests/types';
import { elapsedTime } from '../utils';

const startOfSource = (source: string): number => {
  if (source) {
    return source.search(/\S/) || 0;
  }
  return 0;
};
const endOfSource = (source: string): number => {
  if (source) {
    return source.search(/\S$/) || 0;
  }
  return 0;
};

export type CoverageReportFormats = Exclude<reports.ReportType, 'lcov' | 'text-lcov'>;

export const DefaultWatermarks: libReport.Watermarks = {
  statements: [50, 75],
  functions: [50, 75],
  branches: [50, 75],
  lines: [50, 75]
};

export const DefaultReportOptions: Omit<reports.ReportOptions, 'lcov' | 'text-lcov'> = {
  clover: { file: 'clover.xml', projectRoot: '.' },
  cobertura: { file: 'cobertura.xml', projectRoot: '.' },
  'html-spa': {
    verbose: false,
    skipEmpty: false,
    subdir: 'html-spa',
    linkMapper: undefined as unknown as reports.ReportOptions['html-spa']['linkMapper'],
    metricsToShow: ['lines', 'statements', 'branches']
  },
  html: {
    verbose: false,
    skipEmpty: false,
    subdir: 'html',
    linkMapper: undefined as unknown as reports.ReportOptions['html']['linkMapper']
  },
  json: { file: 'coverage.json' },
  'json-summary': { file: 'coverage-summary.json' },
  lcovonly: { file: 'lcovonly.info', projectRoot: '.' },
  none: {} as never,
  teamcity: { file: 'teamcity.txt', blockName: 'coverage' },
  text: { file: 'text.txt', maxCols: 160, skipEmpty: false, skipFull: false },
  'text-summary': { file: 'text-summary.txt' }
};

export interface CoverageReporterOptions {
  reportFormats?: CoverageReportFormats[];
  reportOptions?: Partial<typeof DefaultReportOptions>;
  watermark?: typeof DefaultWatermarks;
}

/**
 * Utility class to produce various well-known code coverage reports from Apex test coverage results.
 */
export class CoverageReporter {
  private coverageMap!: libCoverage.CoverageMap;

  /**
   *
   * @param coverage - instance of either a ApexCodeCoverageAggregate or ApexCodeCoverage object
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
      this.coverageMap = this.buildCoverageMap();
      fs.statSync(this.reportDir);
      const context = libReport.createContext({
        dir: this.reportDir,
        defaultSummarizer: 'nested',
        watermarks: this.options?.watermark || DefaultWatermarks,
        coverageMap: this.coverageMap
      });
      const formats = this.options?.reportFormats || ['text-summary'];
      formats.forEach(format => {
        const report = reports.create(format, this.options?.reportOptions?.[format] || DefaultReportOptions[format]);
        report.execute(context);
      });
    } catch (e) {
      throw new Error(nls.localize('coverageReportCreationError', e.message));
    }
  }

  @elapsedTime()
  private buildCoverageMap(): libCoverage.CoverageMap {
    const pathsToFiles = this.findFullPathToClass(['cls', 'trigger']);
    const coverageMap = libCoverage.createCoverageMap();
    this.coverage.records.forEach((record: ApexCodeCoverageRecord | ApexCodeCoverageAggregateRecord) => {
      const fileCoverageData: libCoverage.FileCoverageData = {} as libCoverage.FileCoverageData;
      const fileRegEx = new RegExp(`${record.ApexClassOrTrigger.Name}\.(cls|trigger)`);
      fileCoverageData.fnMap = {};
      fileCoverageData.branchMap = {};
      fileCoverageData.path = path.join(
        this.sourceDir,
        pathsToFiles.find(file => fileRegEx.test(file)) || record.ApexClassOrTrigger.Name
      );
      fileCoverageData.f = {};
      fileCoverageData.b = {};
      fileCoverageData.s = Object.fromEntries(
        [
          ...(record.Coverage?.coveredLines ?? []).map(line => [line, 1] as const),
          ...(record.Coverage?.uncoveredLines ?? []).map(line => [line, 0] as const)
        ].map(([line, covered]) => [Number(line).toString(10), covered] as [string, number])
      );
      let sourceLines: string[] = [];
      try {
        sourceLines = fs.readFileSync(fileCoverageData.path, 'utf8').split(os.EOL);
      } catch {
        // file not found
      }
      fileCoverageData.statementMap = Object.fromEntries(
        [...(record.Coverage?.coveredLines ?? []), ...(record.Coverage?.uncoveredLines ?? [])].sort().map(line => {
          const statement: libCoverage.Range = {
            start: {
              line,
              column: startOfSource(sourceLines[line - 1])
            },
            end: {
              line,
              column: endOfSource(sourceLines[line - 1])
            }
          };

          return [Number(line).toString(10), statement] as [string, libCoverage.Range];
        })
      );
      coverageMap.addFileCoverage(fileCoverageData);
    });
    return coverageMap;
  }

  @elapsedTime()
  private findFullPathToClass(listOfExtensions: string[]): string[] {
    const searchPattern = `**/*.{${listOfExtensions.join(',')}}`;
    return glob.sync(searchPattern, { cwd: this.sourceDir });
  }
}
