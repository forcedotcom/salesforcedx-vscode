/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as libReport from 'istanbul-lib-report';
import * as reports from 'istanbul-reports';
import { buildCoverageMap, DefaultReportOptions, generateCoverageReports, IstanbulReports } from '../../src/effect';
import type { ApexCodeCoverageAggregate } from '../../src/tests/types';

const coverage: ApexCodeCoverageAggregate = {
  done: true,
  totalSize: 1,
  records: [
    {
      ApexClassOrTrigger: { Id: '01p000000000001AAA', Name: 'Example' },
      NumLinesCovered: 1,
      NumLinesUncovered: 1,
      Coverage: { coveredLines: [1], uncoveredLines: [2] }
    }
  ]
};
const sources = { Example: { path: '/project/Example.cls', content: '  first;\n  second;' } };

interface CapturedWriter extends Omit<libReport.FileWriter, 'writeForDir'> {
  writerForDir(subdir: string): CapturedWriter;
}

const captureReports = () => {
  const files = new Map<string, string>();
  const copiedFiles: string[] = [];
  const writerForDir = (dir = ''): CapturedWriter => ({
    writerForDir: (subdir: string): CapturedWriter => writerForDir(`${dir}${subdir}/`),
    copyFile: (_source: string, destination: string): void => {
      copiedFiles.push(`${dir}${destination}`);
    },
    writeFile: (file: string | null): libReport.FileContentWriter => {
      const path = `${dir}${file}`;
      files.set(path, '');
      const write = (value: string): void => {
        files.set(path, files.get(path) + value);
      };
      return {
        write,
        println: (value: string): void => write(`${value}\n`),
        colorize: (value: string): string => value,
        close: (): void => {}
      };
    }
  });
  const createContext = vi.fn((options: Omit<libReport.ContextOptions, 'dir'>) => {
    const context = libReport.createContext({ ...options, dir: 'caller-owned' });
    Object.defineProperty(context, 'writer', { value: writerForDir() });
    return context;
  });
  const createReport = vi.fn(reports.create);
  return { files, copiedFiles, createContext, createReport };
};

describe('Effect coverage reports', () => {
  it('builds Istanbul coverage using caller-supplied paths and source text', async () => {
    const map = await Effect.runPromise(buildCoverageMap(coverage, sources));
    const file = map.fileCoverageFor('/project/Example.cls');
    expect(file.s).toEqual({ '1': 1, '2': 0 });
    expect(file.statementMap).toEqual({
      '1': { start: { line: 1, column: 2 }, end: { line: 1, column: 7 } },
      '2': { start: { line: 2, column: 2 }, end: { line: 2, column: 8 } }
    });
    expect(file.toSummary().lines.pct).toBe(50);
  });

  it('retains coverage with unavailable source, and merges repeated class records', async () => {
    const repeated = { ...coverage, records: [...coverage.records, ...coverage.records] };
    const map = await Effect.runPromise(buildCoverageMap(repeated, {}));
    const file = map.fileCoverageFor('Example');
    expect(file.getLineCoverage()).toEqual({ '1': 2, '2': 0 });
    expect(file.statementMap['1'].start.column).toBe(0);
    expect(map.files()).toEqual(['Example']);
  });

  it.each(['\n', '\r\n'])(
    'normalizes %j coverage source lines with default and explicit options',
    async inputLineEnding => {
      const inputSources = { Example: { ...sources.Example, content: `  first;${inputLineEnding}  second;` } };
      for (const lineEnding of [undefined, '\n', '\r\n'] as const) {
        const map = await Effect.runPromise(buildCoverageMap(coverage, inputSources, lineEnding));
        expect(map.fileCoverageFor(sources.Example.path).statementMap).toEqual({
          '1': { start: { line: 1, column: 2 }, end: { line: 1, column: 7 } },
          '2': { start: { line: 2, column: 2 }, end: { line: 2, column: 8 } }
        });
      }
    }
  );

  it('defaults to text-summary, nested summarization, and the existing watermarks', async () => {
    const output = captureReports();
    await Effect.runPromise(
      generateCoverageReports(coverage, sources).pipe(Effect.provideService(IstanbulReports, output))
    );
    expect(output.files.size).toBe(1);
    expect(output.files.get('text-summary.txt')).toBe(
      '\n=============================== Coverage summary ===============================\n' +
        'Statements   : 50% ( 1/2 )\nBranches     : 100% ( 0/0 )\nFunctions    : 100% ( 0/0 )\n' +
        'Lines        : 50% ( 1/2 )\n================================================================================\n'
    );
    expect(output.createReport).toHaveBeenCalledWith('text-summary', DefaultReportOptions['text-summary']);
    expect(output.createContext).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultSummarizer: 'nested',
        watermarks: { statements: [50, 75], branches: [50, 75], functions: [50, 75], lines: [50, 75] }
      })
    );
  });

  it('supports every existing format without taking ownership of files', async () => {
    const output = captureReports();
    await Effect.runPromise(
      generateCoverageReports(coverage, sources, {
        reportFormats: Object.keys(DefaultReportOptions) as (keyof typeof DefaultReportOptions)[]
      }).pipe(Effect.provideService(IstanbulReports, output))
    );
    expect(output.files.get('coverage.json')).toContain('/project/Example.cls');
    expect(output.files.get('clover.xml')).toContain('<coverage');
    expect(output.files.get('cobertura.xml')).toContain('<coverage');
    expect(output.files.get('html/index.html')).toContain('50%');
    expect(output.files.get('html-spa/index.html')).toContain('"pct":50');
    expect(output.copiedFiles.length).toBeGreaterThan(0);
    expect(output.files.has('lcovonly.info')).toBe(true);
    expect(output.files.has('teamcity.txt')).toBe(true);
    expect(output.files.has('text.txt')).toBe(true);
  });

  it('honors format options, watermarks, empty selections, and empty coverage', async () => {
    const output = captureReports();
    const watermark = {
      statements: [10, 90],
      branches: [10, 90],
      functions: [10, 90],
      lines: [10, 90]
    } satisfies libReport.Watermarks;
    await Effect.runPromise(
      generateCoverageReports(
        { ...coverage, records: [] },
        {},
        {
          reportFormats: ['text-summary'],
          reportOptions: { 'text-summary': { file: 'custom.txt' } },
          watermark
        }
      ).pipe(Effect.provideService(IstanbulReports, output))
    );
    expect(output.files.get('custom.txt')).toContain('Unknown%');
    expect(output.createContext).toHaveBeenCalledWith(expect.objectContaining({ watermarks: watermark }));
    const empty = captureReports();
    await Effect.runPromise(
      generateCoverageReports(coverage, sources, { reportFormats: [] }).pipe(
        Effect.provideService(IstanbulReports, empty)
      )
    );
    expect(empty.files.size).toBe(0);
  });

  it('propagates report generation failures as tagged errors without retrying', async () => {
    const output = captureReports();
    output.createReport.mockImplementation(() => {
      throw new Error('writer failed');
    });
    await expect(
      Effect.runPromise(
        generateCoverageReports(coverage, sources).pipe(Effect.provideService(IstanbulReports, output), Effect.flip)
      )
    ).resolves.toMatchObject({
      _tag: 'ApexReportError',
      format: 'coverage',
      cause: 'writer failed',
      message: 'Unexpected error occurred while creating coverage reports. writer failed'
    });
    expect(output.createReport).toHaveBeenCalledTimes(1);
  });
});
