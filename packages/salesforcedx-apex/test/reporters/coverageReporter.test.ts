/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { CoverageReporter } from '../../src/reporters/coverageReporter';
import { tmpdir } from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import * as fs from 'fs';

const multipleCoverageAggregate = {
  done: true,
  totalSize: 4,
  records: [
    {
      attributes: {
        type: 'ApexCodeCoverageAggregate',
        url: '/services/data/v54.0/tooling/sobjects/ApexCodeCoverageAggregate/71511000006fb7kAAA'
      },
      ApexClassOrTrigger: {
        attributes: {
          type: 'Name',
          url: '/services/data/v54.0/tooling/sobjects/ApexClass/01p1100000TqGm6AAF'
        },
        Id: '01p1100000TqGm6AAF',
        Name: 'PagedResult'
      },
      NumLinesCovered: 3,
      NumLinesUncovered: 1,
      Coverage: {
        coveredLines: [3, 6, 9],
        uncoveredLines: [12]
      }
    },
    {
      attributes: {
        type: 'ApexCodeCoverageAggregate',
        url: '/services/data/v54.0/tooling/sobjects/ApexCodeCoverageAggregate/71511000006fb7lAAA'
      },
      ApexClassOrTrigger: {
        attributes: {
          type: 'Name',
          url: '/services/data/v54.0/tooling/sobjects/ApexClass/01p1100000TqGm8AAF'
        },
        Id: '01p1100000TqGm8AAF',
        Name: 'SampleDataController'
      },
      NumLinesCovered: 34,
      NumLinesUncovered: 0,
      Coverage: {
        coveredLines: [
          3, 4, 5, 6, 7, 9, 10, 11, 14, 15, 20, 21, 22, 23, 25, 28, 29, 34, 35,
          36, 37, 39, 40, 43, 44, 49, 50, 51, 52, 54, 57, 58, 59, 60
        ],
        uncoveredLines: []
      }
    },
    {
      attributes: {
        type: 'ApexCodeCoverageAggregate',
        url: '/services/data/v54.0/tooling/sobjects/ApexCodeCoverageAggregate/71511000006fb7mAAA'
      },
      ApexClassOrTrigger: {
        attributes: {
          type: 'Name',
          url: '/services/data/v54.0/tooling/sobjects/ApexClass/01p1100000TqGm7AAF'
        },
        Id: '01p1100000TqGm7AAF',
        Name: 'PropertyController'
      },
      NumLinesCovered: 41,
      NumLinesUncovered: 3,
      Coverage: {
        coveredLines: [
          2, 3, 16, 25, 27, 28, 29, 30, 32, 33, 35, 36, 38, 39, 40, 41, 45, 46,
          47, 48, 49, 50, 52, 67, 68, 69, 70, 71, 72, 75, 76, 87, 88, 92, 97,
          98, 101, 103, 104, 107, 110
        ],
        uncoveredLines: [26, 31, 78]
      }
    },
    {
      attributes: {
        type: 'ApexCodeCoverageAggregate',
        url: '/services/data/v54.0/tooling/sobjects/ApexCodeCoverageAggregate/71511000006fb7nAAA'
      },
      ApexClassOrTrigger: {
        attributes: {
          type: 'Name',
          url: '/services/data/v54.0/tooling/sobjects/ApexClass/01p1100000TqGm4AAF'
        },
        Id: '01p1100000TqGm4AAF',
        Name: 'GeocodingService'
      },
      NumLinesCovered: 36,
      NumLinesUncovered: 0,
      Coverage: {
        coveredLines: [
          5, 8, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
          26, 28, 29, 30, 31, 32, 33, 34, 35, 36, 38, 39, 40, 41, 42, 44, 48, 50
        ],
        uncoveredLines: []
      }
    }
  ]
};

describe('coverageReports', () => {
  let testResultsDir: string;

  beforeEach(async () => {
    testResultsDir = path.join(
      tmpdir(),
      crypto.randomBytes(10).toString('hex')
    );
    await fs.promises.mkdir(testResultsDir, { recursive: true });
  });
  afterEach(async () => {
    try {
      await fs.promises.rmdir(testResultsDir, { recursive: true });
    } catch (err) {}
  });
  it('should produce coverage report', async () => {
    const coverageReport = new CoverageReporter(
      multipleCoverageAggregate,
      testResultsDir,
      'packages/apex-node/test/coverageReporters/testResources',
      {
        reportFormats: ['clover', 'html'],
        reportOptions: {
          clover: {
            file: 'clover.xml',
            projectRoot:
              'packages/apex-node/test/coverageReporters/testResources'
          }
        }
      }
    );
    coverageReport.generateReports();
    const cloverFile = path.join(testResultsDir, 'clover.xml');
    const htmlFile = path.join(testResultsDir, 'html', 'index.html');
    const cloverFileStat = await fs.promises.stat(cloverFile);
    const htmlFileStat = await fs.promises.stat(htmlFile);
    expect(cloverFileStat.isFile()).to.be.true;
    expect(htmlFileStat.isFile()).to.be.true;
    // ensure no other coverage reports were created
    const dirEntries = await fs.promises.readdir(testResultsDir);
    expect(dirEntries).to.have.lengthOf(2);
  });
  it('should produce coverage report using default options', async () => {
    const coverageReport = new CoverageReporter(
      multipleCoverageAggregate,
      testResultsDir,
      'packages/apex-node/test/coverageReporters/testResources'
    );
    coverageReport.generateReports();
    const textSummaryFile = path.join(testResultsDir, 'text-summary.txt');
    const textSummaryFileStat = await fs.promises.stat(textSummaryFile);
    expect(textSummaryFileStat.isFile()).to.be.true;
    // ensure no other coverage reports were created
    const dirEntries = await fs.promises.readdir(testResultsDir);
    expect(dirEntries).to.have.lengthOf(1);
  });
  it('should handle aggregate object with no coverage entries', async () => {
    const coverageAggregate = JSON.parse(
      JSON.stringify(multipleCoverageAggregate)
    );
    coverageAggregate.totalSize = 0;
    coverageAggregate.records = [];
    const coverageReport = new CoverageReporter(
      coverageAggregate,
      testResultsDir,
      'packages/apex-node/test/coverageReporters/testResources'
    );
    coverageReport.generateReports();
    const textSummaryFile = path.join(testResultsDir, 'text-summary.txt');
    const textSummaryFileStat = await fs.promises.stat(textSummaryFile);
    expect(textSummaryFileStat.isFile()).to.be.true;
    const textSummaryContents = await fs.promises.readFile(
      textSummaryFile,
      'utf8'
    );
    expect(textSummaryContents).to.include('Unknown%');
    // ensure no other coverage reports were created
    const dirEntries = await fs.promises.readdir(testResultsDir);
    expect(dirEntries).to.have.lengthOf(1);
  });
  it('should handle non-existent sourceDir', async () => {
    const coverageReport = new CoverageReporter(
      multipleCoverageAggregate,
      testResultsDir,
      'foo/bar/baz'
    );
    coverageReport.generateReports();
    const textSummaryFile = path.join(testResultsDir, 'text-summary.txt');
    const textSummaryFileStat = await fs.promises.stat(textSummaryFile);
    expect(textSummaryFileStat.isFile()).to.be.true;
    // ensure no other coverage reports were created
    const dirEntries = await fs.promises.readdir(testResultsDir);
    expect(dirEntries).to.have.lengthOf(1);
  });
});
