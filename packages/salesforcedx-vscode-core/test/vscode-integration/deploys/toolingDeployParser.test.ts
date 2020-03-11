/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import {
  ToolingDeployParser,
  ToolingRetrieveResult
} from '../../../src/deploys';
import { nls } from '../../../src/messages';

describe('Tooling Deploy Parser', () => {
  const completeDeployResult: ToolingRetrieveResult = {
    State: 'Completed',
    ErrorMsg: null,
    isDeleted: false,
    DeployDetails: {
      componentFailures: [],
      componentSuccesses: [
        {
          columnNumber: null,
          lineNumber: null,
          problem: 'null',
          problemType: 'null',
          fileName: 'classes/testAPI.cls',
          fullName: 'testAPI',
          componentType: 'ApexClass',
          success: true,
          changed: true,
          created: false,
          deleted: false
        }
      ]
    }
  };

  const failedDeployResult: ToolingRetrieveResult = {
    State: 'Failed',
    ErrorMsg: null,
    isDeleted: false,
    DeployDetails: {
      componentFailures: [
        {
          columnNumber: 5,
          lineNumber: 4,
          problem: "Missing ';' at '}'",
          problemType: 'Error',
          fileName: 'classes/testAPI.cls',
          fullName: 'testAPI',
          componentType: 'ApexClass',
          success: false,
          changed: false,
          created: false,
          deleted: false
        },
        {
          columnNumber: 5,
          lineNumber: 4,
          problem: 'Variable does not exist: waa',
          problemType: 'Error',
          fileName: 'classes/testAPI.cls',
          fullName: 'testAPI',
          componentType: 'ApexClass',
          success: false,
          changed: false,
          created: false,
          deleted: false
        }
      ],
      componentSuccesses: []
    }
  };

  const queuedDeployResult = {
    State: 'Queued',
    isDeleted: false,
    DeployDetails: null,
    ErrorMsg: null
  };

  const errorDeployResult = {
    State: 'Error',
    ErrorMsg: 'Unexpected error happened during deploy',
    isDeleted: false,
    DeployDetails: { componentFailures: [], componentSuccesses: [] }
  };

  it('should create array of success info for updated class', async () => {
    const parser = new ToolingDeployParser(completeDeployResult);
    const successInfo = parser.buildSuccesses(
      completeDeployResult.DeployDetails!.componentSuccesses[0]
    );
    expect(successInfo).to.be.an('array');
    expect(successInfo.length).to.be.equal(2);
    expect(successInfo[0]).to.be.an('object');
    expect(successInfo[0].state).to.equal('Updated');
    expect(successInfo[0].fullName).to.equal('testAPI');
    expect(successInfo[0].type).to.equal('ApexClass');
    expect(successInfo[0].filePath).to.equal('classes/testAPI.cls');

    expect(successInfo[1]).to.be.an('object');
    expect(successInfo[1].state).to.equal('Updated');
    expect(successInfo[1].fullName).to.equal('testAPI');
    expect(successInfo[1].type).to.equal('ApexClass');
    expect(successInfo[1].filePath).to.equal('classes/testAPI.cls-meta.xml');
  });

  it('should create array of success info for created class', async () => {
    const parser = new ToolingDeployParser(completeDeployResult);
    const successInfo = parser.buildSuccesses({
      columnNumber: null,
      lineNumber: null,
      problem: 'null',
      problemType: 'null',
      fileName: 'classes/testAPI.cls',
      fullName: 'testAPI',
      componentType: 'ApexClass',
      success: true,
      changed: false,
      created: true,
      deleted: false
    });
    expect(successInfo).to.be.an('array');
    expect(successInfo.length).to.be.equal(2);
    expect(successInfo[0]).to.be.an('object');
    expect(successInfo[0].state).to.equal('Created');
    expect(successInfo[0].fullName).to.equal('testAPI');
    expect(successInfo[0].type).to.equal('ApexClass');
    expect(successInfo[0].filePath).to.equal('classes/testAPI.cls');

    expect(successInfo[1]).to.be.an('object');
    expect(successInfo[1].state).to.equal('Created');
    expect(successInfo[1].fullName).to.equal('testAPI');
    expect(successInfo[1].type).to.equal('ApexClass');
    expect(successInfo[1].filePath).to.equal('classes/testAPI.cls-meta.xml');
  });

  it('should create array of error info for apex class', async () => {
    const parser = new ToolingDeployParser(failedDeployResult);
    const errorsInfo = parser.buildErrors(
      failedDeployResult.DeployDetails!.componentFailures
    );
    expect(errorsInfo).to.be.an('array');
    expect(errorsInfo.length).to.be.equal(2);
    expect(errorsInfo[0]).to.be.an('object');
    expect(errorsInfo[0].filePath).to.equal('classes/testAPI.cls');
    expect(errorsInfo[0].error).to.equal("Missing ';' at '}' (4:5)");

    expect(errorsInfo[1]).to.be.an('object');
    expect(errorsInfo[1].filePath).to.equal('classes/testAPI.cls');
    expect(errorsInfo[1].error).to.equal('Variable does not exist: waa (4:5)');
  });

  it('should create a table with successful results', async () => {
    const parser = new ToolingDeployParser(completeDeployResult);

    let mockResult = '=== Deployed Source\n';
    mockResult +=
      'STATE    FULL NAME  TYPE       PROJECT PATH                \n';
    mockResult +=
      '───────  ─────────  ─────────  ────────────────────────────\n';
    mockResult +=
      'Updated  testAPI    ApexClass  classes/testAPI.cls         \n';
    mockResult +=
      'Updated  testAPI    ApexClass  classes/testAPI.cls-meta.xml\n';

    const results = await parser.outputResult();
    expect(results).to.equal(mockResult);
  });

  it('should create a table with failed results', async () => {
    const parser = new ToolingDeployParser(failedDeployResult);

    let errorResult = '=== Deploy Errors\n';
    errorResult +=
      'PROJECT PATH         ERRORS                                  \n';
    errorResult +=
      '───────────────────  ────────────────────────────────────────\n';
    errorResult +=
      "classes/testAPI.cls  Missing ';' at '}' (4:5) (4:5)          \n";
    errorResult +=
      'classes/testAPI.cls  Variable does not exist: waa (4:5) (4:5)\n';

    const results = await parser.outputResult();
    expect(results).to.equal(errorResult);
  });

  it('should create a table with error results', async () => {
    const parser = new ToolingDeployParser(errorDeployResult);

    let errorResult = '=== Deploy Errors\n';
    errorResult +=
      'PROJECT PATH         ERRORS                                 \n';
    errorResult +=
      '───────────────────  ───────────────────────────────────────\n';
    errorResult +=
      'classes/testAPI.cls  Unexpected error happened during deploy\n';

    const results = await parser.outputResult('classes/testAPI.cls');
    expect(results).to.equal(errorResult);
  });

  it('should create a table with queued results', async () => {
    const parser = new ToolingDeployParser(queuedDeployResult);
    const results = await parser.outputResult();
    expect(results).to.equal(nls.localize('beta_tapi_queue_status'));
  });
});
