/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  TestResult,
  OutputDirConfig,
  ResultFormat,
  HumanReporter,
  JUnitReporter,
  TapReporter
} from '@salesforce/apex-node';
import { CliJsonFormat } from './jsonReporter';

/**
 * Builds output directory configuration with CLI format result files
 * @param result Test results from async/sync test run
 * @param jsonOutput JSON CLI format of test results
 * @param outputDir Output directory for result files
 * @param resultFormat Result format for output files
 * @param detailedCoverage Boolean to control detailed coverage reporting
 * @returns Output directory configuration
 */
export function buildOutputDirConfig(
  result: TestResult,
  jsonOutput: CliJsonFormat,
  outputDir: string,
  resultFormat: ResultFormat,
  detailedCoverage: boolean
): OutputDirConfig {
  const outputDirConfig: OutputDirConfig = {
    dirPath: outputDir,
    fileInfos: [
      {
        filename: `test-result-${result.summary.testRunId}.json`,
        content: jsonOutput
      },
      ...(jsonOutput.coverage
        ? [
            {
              filename: `test-result-codecoverage.json`,
              content: jsonOutput.coverage.coverage
            }
          ]
        : [])
    ],
    resultFormats: [ResultFormat.junit]
  };

  switch (resultFormat) {
    case 'tap':
      const tapResult = new TapReporter().format(result);
      outputDirConfig.fileInfos?.push({
        filename: `test-result.txt`,
        content: tapResult
      });
      outputDirConfig.resultFormats?.push(ResultFormat.tap);
      break;
    case 'junit':
      const junitResult = new JUnitReporter().format(result);
      outputDirConfig.fileInfos?.push({
        filename: `test-result.xml`,
        content: junitResult
      });
      break;
    case 'human':
      const humanResult = new HumanReporter().format(result, detailedCoverage);
      outputDirConfig.fileInfos?.push({
        filename: `test-result.txt`,
        content: humanResult
      });
      break;
  }
  return outputDirConfig;
}
