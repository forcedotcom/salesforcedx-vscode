/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  registryData,
  SourceComponent,
  SourceDeployResult,
  ToolingDeployStatus
} from '@salesforce/source-deploy-retrieve';
import {
  ComponentStatus,
  DeployStatus
} from '@salesforce/source-deploy-retrieve/lib/types';
import { expect } from 'chai';
import * as path from 'path';
import { LibraryDeployResultParser } from '../../../../src/commands/util/libraryDeployResultParser';
import { nls } from '../../../../src/messages';

describe('Tooling Deploy Parser', () => {
  let props;
  let virtualFs;
  let component;
  props = {
    name: 'testAPI',
    type: registryData.types.apexclass,
    xml: path.join('classes', 'testAPI.cls-meta.xml'),
    content: path.join('classes', 'testAPI.cls')
  };
  virtualFs = {
    dirPath: 'classes',
    children: ['testAPI.cls', 'testAPI.cls-meta.xml']
  };

  component = SourceComponent.createVirtualComponent(props, [virtualFs]);
  const completeDeployResult: SourceDeployResult = {
    success: true,
    id: '',
    status: ToolingDeployStatus.Completed,
    components: [
      { component, status: ComponentStatus.Changed, diagnostics: [] }
    ]
  };

  props = {
    name: 'testAPI',
    type: registryData.types.lightningcomponentbundle,
    xml: path.join('classes', 'testAPI.js-meta.xml'),
    content: path.join('classes', 'testAPI.js')
  };
  virtualFs = {
    dirPath: 'classes',
    children: ['testAPI.js', 'testAPI.js-meta.xml']
  };
  component = SourceComponent.createVirtualComponent(props, [virtualFs]);
  const lwcCompleteDeployResult: SourceDeployResult = {
    success: true,
    id: '',
    status: DeployStatus.Succeeded,
    components: [
      { component, status: ComponentStatus.Created, diagnostics: [] }
    ]
  };
  component = SourceComponent.createVirtualComponent(props, [virtualFs]);
  const failedDeployResult: SourceDeployResult = {
    success: false,
    id: '',
    status: DeployStatus.Failed,
    components: [
      {
        component,
        status: ComponentStatus.Created,
        diagnostics: [
          {
            lineNumber: 4,
            columnNumber: 5,
            filePath: 'classes/testAPI.cls',
            message: "Missing ';' at '}'",
            type: 'Error'
          }
        ]
      }
    ]
  };
  props = {
    name: 'testAPI',
    type: registryData.types.apexclass,
    xml: path.join('classes', 'testAPI.cls-meta.xml'),
    content: path.join('classes', 'testAPI.cls')
  };
  virtualFs = {
    dirPath: 'classes',
    children: ['testAPI.cls', 'testAPI.cls-meta.xml']
  };
  component = SourceComponent.createVirtualComponent(props, [virtualFs]);
  const failedManagedPkgDeployResult: SourceDeployResult = {
    success: false,
    id: '',
    status: ToolingDeployStatus.Failed,
    components: [
      {
        component,
        status: ComponentStatus.Created,
        diagnostics: [
          {
            filePath: 'classes/testAPI.cls',
            message:
              'Could not save testAPI, : managed installed classes cannot be saved',
            type: 'Error'
          },
          {
            filePath: 'classes/testAPI.cls-meta.xml',
            message:
              'Could not save testAPI, : managed installed classes cannot be saved',
            type: 'Error'
          }
        ]
      }
    ]
  };

  const queuedDeployResult: SourceDeployResult = {
    id: '',
    status: ToolingDeployStatus.Queued,
    components: [],
    success: true
  };

  const errorDeployResult: SourceDeployResult = {
    id: '',
    success: false,
    components: [
      {
        component,
        status: ComponentStatus.Failed,
        diagnostics: [
          {
            type: 'Error',
            filePath: path.join('classes', 'testAPI.cls'),
            message: 'Unexpected error happened during deploy'
          }
        ]
      }
    ],
    status: ToolingDeployStatus.Error
  };

  it('should create array of success info for updated class', async () => {
    const parser = new LibraryDeployResultParser(completeDeployResult);
    const successInfo = parser.buildSuccesses(completeDeployResult);
    expect(successInfo).to.be.an('array');
    expect(successInfo.length).to.be.equal(2);
    expect(successInfo[0]).to.be.an('object');
    expect(successInfo[0].state).to.equal('Changed');
    expect(successInfo[0].fullName).to.equal('testAPI');
    expect(successInfo[0].type).to.equal('ApexClass');
    expect(successInfo[0].filePath).to.equal('classes/testAPI.cls');
    expect(successInfo[1]).to.be.an('object');
    expect(successInfo[1].state).to.equal('Changed');
    expect(successInfo[1].fullName).to.equal('testAPI');
    expect(successInfo[1].type).to.equal('ApexClass');
    expect(successInfo[1].filePath).to.equal('classes/testAPI.cls-meta.xml');
  });

  it('should create array of success info for created class', async () => {
    const parser = new LibraryDeployResultParser(completeDeployResult);
    const successInfo = parser.buildSuccesses(lwcCompleteDeployResult);
    expect(successInfo).to.be.an('array');
    expect(successInfo.length).to.be.equal(2);
    expect(successInfo[0]).to.be.an('object');
    expect(successInfo[0].state).to.equal('Created');
    expect(successInfo[0].fullName).to.equal('testAPI');
    expect(successInfo[0].type).to.equal('LightningComponentBundle');
    expect(successInfo[0].filePath).to.equal('classes/testAPI.js');

    expect(successInfo[1]).to.be.an('object');
    expect(successInfo[1].state).to.equal('Created');
    expect(successInfo[1].fullName).to.equal('testAPI');
    expect(successInfo[1].type).to.equal('LightningComponentBundle');
    expect(successInfo[1].filePath).to.equal('classes/testAPI.js-meta.xml');
  });

  it('should create array of error info for apex class', async () => {
    const parser = new LibraryDeployResultParser(failedDeployResult);
    const errorsInfo = parser.buildErrors(failedDeployResult);
    expect(errorsInfo).to.be.an('array');
    expect(errorsInfo.length).to.be.equal(1);
    expect(errorsInfo[0]).to.be.an('object');
    expect(errorsInfo[0].filePath).to.equal('classes/testAPI.cls');
    expect(errorsInfo[0].error).to.equal("Missing ';' at '}' (4:5)");
  });

  it('should create array of error info for managed package deploy error', async () => {
    const parser = new LibraryDeployResultParser(failedManagedPkgDeployResult);
    const errorsInfo = parser.buildErrors(failedManagedPkgDeployResult);
    expect(errorsInfo).to.be.an('array');
    expect(errorsInfo.length).to.be.equal(2);
    expect(errorsInfo[0]).to.be.an('object');
    expect(errorsInfo[0].filePath).to.equal(
      path.join('classes', 'testAPI.cls')
    );
    expect(errorsInfo[0].error).to.equal(
      'Could not save testAPI, : managed installed classes cannot be saved'
    );

    expect(errorsInfo[1]).to.be.an('object');
    expect(errorsInfo[1].filePath).to.equal(
      path.join('classes', 'testAPI.cls-meta.xml')
    );
    expect(errorsInfo[1].error).to.equal(
      'Could not save testAPI, : managed installed classes cannot be saved'
    );
  });

  it('should create a table with successful results', async () => {
    const parser = new LibraryDeployResultParser(completeDeployResult);

    let mockResult = '=== Deployed Source\n';
    mockResult +=
      'STATE    FULL NAME  TYPE       PROJECT PATH                \n';
    mockResult +=
      '───────  ─────────  ─────────  ────────────────────────────\n';
    mockResult +=
      'Changed  testAPI    ApexClass  classes/testAPI.cls         \n';
    mockResult +=
      'Changed  testAPI    ApexClass  classes/testAPI.cls-meta.xml\n';

    const results = parser.resultParser(completeDeployResult);
    expect(results).to.equal(mockResult);
  });

  it('should create a table with successful results for LWC', async () => {
    const parser = new LibraryDeployResultParser(lwcCompleteDeployResult);

    let mockResult = '=== Deployed Source\n';
    mockResult +=
      'STATE    FULL NAME  TYPE                      PROJECT PATH               \n';
    mockResult +=
      '───────  ─────────  ────────────────────────  ───────────────────────────\n';
    mockResult +=
      'Created  testAPI    LightningComponentBundle  classes/testAPI.js         \n';
    mockResult +=
      'Created  testAPI    LightningComponentBundle  classes/testAPI.js-meta.xml\n';

    const results = parser.resultParser(lwcCompleteDeployResult);
    expect(results).to.equal(mockResult);
  });

  it('should create a table with failed results', async () => {
    const parser = new LibraryDeployResultParser(failedDeployResult);

    let errorResult = '=== Deploy Errors\n';
    errorResult += 'PROJECT PATH         ERRORS                  \n';
    errorResult += '───────────────────  ────────────────────────\n';
    errorResult += "classes/testAPI.cls  Missing ';' at '}' (4:5)\n";

    const results = parser.resultParser(failedDeployResult);
    expect(results).to.equal(errorResult);
  });

  // component content disallows for multiple paths to errors
  it('should create a table with failed results for managed package errors', async () => {
    const parser = new LibraryDeployResultParser(failedManagedPkgDeployResult);

    let errorResult = '=== Deploy Errors\n';
    errorResult +=
      'PROJECT PATH                            ERRORS                                                             \n';
    errorResult +=
      '──────────────────────────────────────  ───────────────────────────────────────────────────────────────────\n';
    errorResult += `${path.join(
      'classes',
      'testAPI.cls'
    )}           Could not save testAPI, : managed installed classes cannot be saved\n`;
    errorResult += `${path.join(
      'classes',
      'testAPI.cls-meta.xml'
    )}  Could not save testAPI, : managed installed classes cannot be saved\n`;

    const results = await parser.resultParser(failedManagedPkgDeployResult);
    expect(results).to.equal(errorResult);
  });

  it('should create a table with error results', async () => {
    const parser = new LibraryDeployResultParser(errorDeployResult);

    let errorResult = '=== Deploy Errors\n';
    errorResult +=
      'PROJECT PATH         ERRORS                                 \n';
    errorResult +=
      '───────────────────  ───────────────────────────────────────\n';
    errorResult +=
      'classes/testAPI.cls  Unexpected error happened during deploy\n';

    const results = parser.resultParser(errorDeployResult);
    expect(results).to.equal(errorResult);
  });

  it('should create a table with queued results', async () => {
    const parser = new LibraryDeployResultParser(queuedDeployResult);
    const results = await parser.resultParser(queuedDeployResult);
    expect(results).to.equal(nls.localize('beta_tapi_queue_status'));
  });
});
