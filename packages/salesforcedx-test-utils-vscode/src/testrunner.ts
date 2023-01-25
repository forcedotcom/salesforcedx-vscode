'use strict';

import * as glob from 'glob';
import * as paths from 'path';

// tslint:disable:no-var-requires
// tslint:disable-next-line:variable-name
const Mocha = require('mocha');

// Linux: prevent a weird NPE when mocha on Linux requires the window size from the TTY
// Since we are not running in a tty environment, we just implementt he method statically
const tty = require('tty');
if (!tty.getWindowSize) {
  tty.getWindowSize = (): number[] => {
    return [80, 75];
  };
}

let mocha = new Mocha({
  ui: 'tdd',
  useColors: true,
  reporter: 'mocha-multi-reporters'
});

function configure(mochaOpts: any, xmlOutputDirectory: string): void {
  if (mochaOpts.reporter == null) {
    // default to 'mocha-multi-reporters' (to get xunit.xml result)
    mochaOpts.reporter = 'mocha-multi-reporters';
  }
  if (!mochaOpts.reporterOptions) {
    const junitOutputFileLocation = paths.join(
      xmlOutputDirectory,
      'junit-custom-vscodeIntegrationTests.xml'
    );
    const xunitOutputFileLocation = paths.join(
      xmlOutputDirectory,
      'xunit-vscodeIntegrationTests.xml'
    );

    console.log('Output locations for reporters: ', {
      junitOutputFileLocation,
      xunitOutputFileLocation
    });
    mochaOpts.reporterOptions = {
      reporterEnabled: 'mocha-junit-reporter, xunit, spec',
      mochaJunitReporterReporterOptions: {
        mochaFile: junitOutputFileLocation
      },
      xunitReporterOptions: {
        output: xunitOutputFileLocation
      }
    };
  }
  mocha = new Mocha(mochaOpts);
}
exports.configure = configure;

function run(testsRoot: any, clb: any): any {
  let testGlobPath;
  const testFilePath = process.env.SFDX_TEST_FILE_PATH;
  if (testFilePath) {
    const { name: testFileBasenameNoExtension } = paths.parse(testFilePath);
    const testFilePathSegments = testFilePath.split(paths.sep);
    const packagesDirIndex = testFilePathSegments.findIndex(
      s => s === 'packages'
    );
    testsRoot = paths.join(
      ...testFilePathSegments.slice(0, packagesDirIndex + 2),
      'out/test'
    );
    if (!/^win32/.test(process.platform)) {
      testsRoot = paths.join('/', testsRoot);
    }
    testGlobPath = `**/${testFileBasenameNoExtension}.js`;
  }

  // Enable source map support
  require('source-map-support').install();

  // Glob test files
  glob(
    testGlobPath ? testGlobPath : '**/**.test.js',
    { cwd: testsRoot },
    (error, files): any => {
      if (error) {
        console.error('An error occured: ' + error);
        return clb(error);
      }
      try {
        // Fill into Mocha
        files.forEach(
          (f): Mocha => {
            return mocha.addFile(paths.join(testsRoot, f));
          }
        );
        // Run the tests
        let failureCount = 0;

        mocha
          .run((failures: any) => {
            process.on('exit', () => {
              console.log(
                `Existing test process, code should be ${failureCount}`
              );
              process.exit(failures); // exit with non-zero status if there were failures
            });
          })
          .on('fail', (test: any, err: any): void => {
            console.log(`Failure in test '${test}': ${err}`);
            failureCount++;
          })
          .on('end', (): void => {
            console.log(`Tests ended with ${failureCount} failure(s)`);
            clb(undefined, failureCount);
            // if (!isNullOrUndefined(coverageRunner)) {
            //   coverageRunner.reportCoverage();
            // }
          });
      } catch (error) {
        console.error('An error occured: ' + error);
        return clb(error);
      }
    }
  );
}
exports.run = run;

interface ITestRunnerOptions {
  enabled?: boolean;
  relativeCoverageDir: string;
  relativeSourcePath: string;
  ignorePatterns: string[];
  includePid?: boolean;
  reports?: string[];
  verbose?: boolean;
}

declare var global: {
  [key: string]: any; // missing index defintion
};
