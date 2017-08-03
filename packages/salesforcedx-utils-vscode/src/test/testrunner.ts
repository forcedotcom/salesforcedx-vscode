/*
 * rewritten test runner for integrating code coverage;
 * https://github.com/codecov/example-typescript-vscode-extension
 */

'use strict';

import * as fs from 'fs';
import * as glob from 'glob';
import * as paths from 'path';

// tslint:disable:no-var-requires
const istanbul = require('istanbul');
// tslint:disable-next-line:variable-name
const Mocha = require('mocha');
const remapIstanbul = require('remap-istanbul');

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

function configure(mochaOpts: any): void {
  mocha = new Mocha(mochaOpts);
}
exports.configure = configure;

function _mkDirIfExists(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
}

function _readCoverOptions(testsRoot: string): ITestRunnerOptions | undefined {
  const coverConfigPath = paths.join(testsRoot, '..', '..', 'coverconfig.json');
  let coverConfig: ITestRunnerOptions | undefined = undefined;
  if (fs.existsSync(coverConfigPath)) {
    const configContent = fs.readFileSync(coverConfigPath, 'utf-8');
    coverConfig = JSON.parse(configContent);
  }
  return coverConfig;
}

function run(testsRoot: any, clb: any): any {
  // Enable source map support
  require('source-map-support').install();

  // Read configuration for the coverage file
  const coverOptions: ITestRunnerOptions | undefined = _readCoverOptions(
    testsRoot
  );
  if (coverOptions && coverOptions.enabled) {
    // Setup coverage pre-test, including post-test hook to report
    const coverageRunner = new CoverageRunner(coverOptions, testsRoot, clb);
    coverageRunner.setupCoverage();
  }

  // Glob test files
  glob('**/**.test.js', { cwd: testsRoot }, (error, files): any => {
    if (error) {
      return clb(error);
    }
    try {
      // Fill into Mocha
      files.forEach((f): Mocha => {
        return mocha.addFile(paths.join(testsRoot, f));
      });
      // Run the tests
      let failureCount = 0;

      mocha
        .run()
        .on('fail', (test: any, err: any): void => {
          failureCount++;
        })
        .on('end', (): void => {
          clb(undefined, failureCount);
        });
    } catch (error) {
      return clb(error);
    }
  });
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

class CoverageRunner {
  private coverageVar: string = '$$cov_' + new Date().getTime() + '$$';
  private transformer: any = undefined;
  private matchFn: any = undefined;
  private instrumenter: any = undefined;

  constructor(
    private options: ITestRunnerOptions,
    private testsRoot: string,
    errorRunCallback: (error: string) => any
  ) {
    if (!options.relativeSourcePath) {
      return errorRunCallback(
        'Error - relativeSourcePath must be defined for code coverage to work'
      );
    }
  }

  public setupCoverage(): void {
    // Set up Code Coverage, hooking require so that instrumented code is returned
    const self = this;
    self.instrumenter = new istanbul.Instrumenter({
      coverageVariable: self.coverageVar
    });
    const sourceRoot = paths.join(
      self.testsRoot,
      self.options.relativeSourcePath
    );

    // Glob source files
    const srcFiles = glob.sync('**/**.js', {
      cwd: sourceRoot,
      ignore: self.options.ignorePatterns
    });

    // Create a match function - taken from the run-with-cover.js in istanbul.
    const decache = require('decache');
    interface FileMap {
      [key: string]: boolean;
    }
    const fileMap: FileMap = {};
    srcFiles.forEach(file => {
      const fullPath = paths.join(sourceRoot, file);
      fileMap[fullPath] = true;

      // On Windows, extension is loaded pre-test hooks and this mean we lose
      // our chance to hook the Require call. In order to instrument the code
      // we have to decache the JS file so on next load it gets instrumented.
      // This doesn"t impact tests, but is a concern if we had some integration
      // tests that relied on VSCode accessing our module since there could be
      // some shared global state that we lose.
      decache(fullPath);
    });

    self.matchFn = (file: string): boolean => {
      return fileMap[file];
    };
    self.matchFn.files = Object.keys(fileMap);

    // Hook up to the Require function so that when this is called, if any of our source files
    // are required, the instrumented version is pulled in instead. These instrumented versions
    // write to a global coverage variable with hit counts whenever they are accessed
    self.transformer = self.instrumenter.instrumentSync.bind(self.instrumenter);
    const hookOpts = { verbose: false, extensions: ['.js'] };
    istanbul.hook.hookRequire(self.matchFn, self.transformer, hookOpts);

    // initialize the global variable to stop mocha from complaining about leaks
    global[self.coverageVar] = {};

    // Hook the process exit event to handle reporting
    // Only report coverage if the process is exiting successfully
    process.on('exit', (code: any) => {
      self.reportCoverage();
    });
  }

  /**
   * Writes a coverage report. Note that as this is called in the process exit callback, all calls must be synchronous.
   *
   * @returns {void}
   *
   * @memberOf CoverageRunner
   */
  public reportCoverage(): void {
    const self = this;
    istanbul.hook.unhookRequire();
    let cov: any;
    if (
      typeof global[self.coverageVar] === 'undefined' ||
      Object.keys(global[self.coverageVar]).length === 0
    ) {
      console.error(
        'No coverage information was collected, exit without writing coverage information'
      );
      return;
    } else {
      cov = global[self.coverageVar];
    }

    // TODO consider putting this under a conditional flag
    // Files that are not touched by code ran by the test runner is manually instrumented, to
    // illustrate the missing coverage.
    self.matchFn.files.forEach((file: string) => {
      if (!cov[file]) {
        self.transformer(fs.readFileSync(file, 'utf-8'), file);

        // When instrumenting the code, istanbul will give each FunctionDeclaration a value of 1 in coverState.s,
        // presumably to compensate for function hoisting. We need to reset this, as the function was not hoisted,
        // as it was never loaded.
        Object.keys(self.instrumenter.coverState.s).forEach(key => {
          self.instrumenter.coverState.s[key] = 0;
        });

        cov[file] = self.instrumenter.coverState;
      }
    });

    // TODO Allow config of reporting directory with
    const reportingDir = paths.join(
      self.testsRoot,
      self.options.relativeCoverageDir
    );
    const includePid = self.options.includePid;
    const pidExt = includePid ? '-' + process.pid : '';
    const coverageFile = paths.resolve(
      reportingDir,
      'coverage' + pidExt + '.json'
    );

    _mkDirIfExists(reportingDir); // yes, do this again since some test runners could clean the dir initially created

    fs.writeFileSync(coverageFile, JSON.stringify(cov), { encoding: 'utf8' });

    const remappedCollector = remapIstanbul.remap(cov, {
      warn: (warning: string) => {
        // We expect some warnings as any JS file without a typescript mapping will cause this.
        // By default, we"ll skip printing these to the console as it clutters it up
        if (self.options.verbose) {
          console.warn(warning);
        }
      }
    });

    const reporter = new istanbul.Reporter(undefined, reportingDir);
    const reportTypes =
      self.options.reports instanceof Array ? self.options.reports : ['lcov'];
    reporter.addAll(reportTypes);
    reporter.write(remappedCollector, true, () => {
      console.log(`reports written to ${reportingDir}`);
    });
  }
}
