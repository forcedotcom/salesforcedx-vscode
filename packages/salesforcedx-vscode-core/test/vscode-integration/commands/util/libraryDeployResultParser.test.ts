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

describe('Deploy Parser', () => {
  const apexClassPath = path.join('classes', 'test.cls');
  const apexClassXmlPath = `${apexClassPath}-meta.xml`;
  const lwcJsPath = path.join('lwc', 'test', 'test.js');
  const lwcXmlPath = `${lwcJsPath}-meta.xml`;
  const apexComponent = SourceComponent.createVirtualComponent(
    {
      name: 'test',
      type: registryData.types.apexclass,
      xml: apexClassXmlPath,
      content: apexClassPath
    },
    [
      {
        dirPath: 'classes',
        children: ['test.cls', 'test.cls-meta.xml']
      }
    ]
  );
  const lwcComponent = SourceComponent.createVirtualComponent(
    {
      name: 'test',
      type: registryData.types.lightningcomponentbundle,
      xml: lwcXmlPath,
      content: path.join('lwc', 'test')
    },
    [
      {
        dirPath: 'lwc',
        children: ['test']
      },
      {
        dirPath: path.join('lwc', 'test'),
        children: ['test.js', 'test.js-meta.xml']
      }
    ]
  );

  const completeApexResult: SourceDeployResult = {
    success: true,
    id: '',
    status: ToolingDeployStatus.Completed,
    components: [
      {
        component: apexComponent,
        status: ComponentStatus.Changed,
        diagnostics: []
      }
    ]
  };
  const succeededLwcResult: SourceDeployResult = {
    success: true,
    id: '',
    status: DeployStatus.Succeeded,
    components: [
      {
        component: lwcComponent,
        status: ComponentStatus.Created,
        diagnostics: []
      }
    ]
  };
  const failedApexResult: SourceDeployResult = {
    success: false,
    id: '',
    status: DeployStatus.Failed,
    components: [
      {
        component: apexComponent,
        status: ComponentStatus.Created,
        diagnostics: [
          {
            lineNumber: 4,
            columnNumber: 5,
            filePath: apexClassPath,
            message: "Missing ';' at '}'",
            type: 'Error'
          },
          {
            lineNumber: 7,
            columnNumber: 9,
            filePath: apexClassPath,
            message: "Extra ':' at '}'",
            type: 'Error'
          }
        ]
      }
    ]
  };
  const failedManagedPkgDeployResult: SourceDeployResult = {
    success: false,
    id: '',
    status: ToolingDeployStatus.Failed,
    components: [
      {
        component: apexComponent,
        status: ComponentStatus.Created,
        diagnostics: [
          {
            filePath: apexClassPath,
            message:
              'Could not save testAPI, : managed installed classes cannot be saved',
            type: 'Error'
          }
        ]
      },
      {
        component: apexComponent,
        status: ComponentStatus.Failed,
        diagnostics: [
          {
            filePath: apexClassXmlPath,
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
    status: ToolingDeployStatus.Error,
    components: [
      {
        component: apexComponent,
        status: ComponentStatus.Failed,
        diagnostics: [
          {
            type: 'Error',
            filePath: apexClassPath,
            message: 'Unexpected error happened during deploy'
          }
        ]
      }
    ]
  };

  // it('should create array of success info for updated class', async () => {
  //   const parser = new LibraryDeployResultParser(completeApexResult);
  //   const successInfo = parser.buildSuccesses(completeApexResult);
  //   expect(successInfo).to.be.an('array');
  //   expect(successInfo.length).to.be.equal(2);
  //   expect(successInfo[0]).to.be.an('object');
  //   expect(successInfo[0].state).to.equal('Changed');
  //   expect(successInfo[0].fullName).to.equal('testAPI');
  //   expect(successInfo[0].type).to.equal('ApexClass');
  //   expect(successInfo[0].filePath).to.equal(apexClassPath);

  //   expect(successInfo[1]).to.be.an('object');
  //   expect(successInfo[1].state).to.equal('Changed');
  //   expect(successInfo[1].fullName).to.equal('testAPI');
  //   expect(successInfo[1].type).to.equal('ApexClass');
  //   expect(successInfo[1].filePath).to.equal(apexClassXmlPath);
  // });

  // it('should create array of success info for created class', async () => {
  //   const parser = new LibraryDeployResultParser(completeApexResult);
  //   const successInfo = parser.buildSuccesses(succeededLwcResult);
  //   expect(successInfo).to.be.an('array');
  //   expect(successInfo.length).to.be.equal(2);
  //   expect(successInfo[0]).to.be.an('object');
  //   expect(successInfo[0].state).to.equal('Created');
  //   expect(successInfo[0].fullName).to.equal('testAPI');
  //   expect(successInfo[0].type).to.equal('LightningComponentBundle');
  //   expect(successInfo[0].filePath).to.equal(lwcJsPath);

  //   expect(successInfo[1]).to.be.an('object');
  //   expect(successInfo[1].state).to.equal('Created');
  //   expect(successInfo[1].fullName).to.equal('testAPI');
  //   expect(successInfo[1].type).to.equal('LightningComponentBundle');
  //   expect(successInfo[1].filePath).to.equal(lwcXmlPath);
  // });

  // it('should create array of error info for apex class', async () => {
  //   const parser = new LibraryDeployResultParser(failedApexResult);
  //   const errorsInfo = parser.buildErrors(failedApexResult);
  //   expect(errorsInfo).to.be.an('array');
  //   expect(errorsInfo.length).to.be.equal(2);
  //   expect(errorsInfo[0]).to.be.an('object');
  //   expect(errorsInfo[0].filePath).to.equal(apexClassPath);
  //   expect(errorsInfo[0].error).to.equal("Missing ';' at '}' (4:5)");

  //   expect(errorsInfo[1]).to.be.an('object');
  //   expect(errorsInfo[1].filePath).to.equal(apexClassPath);
  //   expect(errorsInfo[1].error).to.equal("Extra ':' at '}' (7:9)");
  // });

  // it('should create array of error info for managed package deploy error', async () => {
  //   const parser = new LibraryDeployResultParser(failedManagedPkgDeployResult);
  //   const errorsInfo = parser.buildErrors(failedManagedPkgDeployResult);
  //   console.log(errorsInfo);
  //   expect(errorsInfo).to.be.an('array');
  //   expect(errorsInfo.length).to.be.equal(2);
  //   expect(errorsInfo[0]).to.be.an('object');
  //   expect(errorsInfo[0].filePath).to.equal(apexClassPath);
  //   expect(errorsInfo[0].error).to.equal(
  //     'Could not save testAPI, : managed installed classes cannot be saved'
  //   );

  //   expect(errorsInfo[1]).to.be.an('object');
  //   expect(errorsInfo[1].filePath).to.equal(apexClassXmlPath);
  //   expect(errorsInfo[1].error).to.equal(
  //     'Could not save testAPI, : managed installed classes cannot be saved'
  //   );
  // });

  it('should create a table with successful results', async () => {
    const parser = new LibraryDeployResultParser(completeApexResult);
    const { fullName } = apexComponent;

    let mockResult = '=== Deployed Source\n';
    mockResult += 'STATE    FULL NAME  TYPE       PROJECT PATH             \n';
    mockResult += '───────  ─────────  ─────────  ─────────────────────────\n';
    mockResult += `Changed  ${fullName}       ApexClass  ${apexClassPath}         \n`;
    mockResult += `Changed  ${fullName}       ApexClass  ${apexClassXmlPath}\n`;

    const results = parser.resultParser(completeApexResult);
    expect(results).to.equal(mockResult);
  });

  it('should create a table with successful results for LWC', async () => {
    const parser = new LibraryDeployResultParser(succeededLwcResult);
    const { fullName } = lwcComponent;

    let mockResult = '=== Deployed Source\n';
    mockResult +=
      'STATE    FULL NAME  TYPE                      PROJECT PATH             \n';
    mockResult +=
      '───────  ─────────  ────────────────────────  ─────────────────────────\n';
    mockResult += `Created  ${fullName}       LightningComponentBundle  ${lwcJsPath}         \n`;
    mockResult += `Created  ${fullName}       LightningComponentBundle  ${lwcXmlPath}\n`;

    const results = parser.resultParser(succeededLwcResult);
    expect(results).to.equal(mockResult);
  });

  it('should create a table with failed results', async () => {
    const parser = new LibraryDeployResultParser(failedApexResult);

    let errorResult = '=== Deploy Errors\n';
    errorResult += 'PROJECT PATH      ERRORS                  \n';
    errorResult += '────────────────  ────────────────────────\n';
    errorResult += `${apexClassPath}  Missing ';' at '}' (4:5)\n`;
    errorResult += `${apexClassPath}  Extra ':' at '}' (7:9)  \n`;

    const results = parser.resultParser(failedApexResult);
    expect(results).to.equal(errorResult);
  });

  it('should create a table with failed results for managed package errors', async () => {
    const parser = new LibraryDeployResultParser(failedManagedPkgDeployResult);

    let errorResult = '=== Deploy Errors\n';
    errorResult +=
      'PROJECT PATH               ERRORS                                                             \n';
    errorResult +=
      '─────────────────────────  ───────────────────────────────────────────────────────────────────\n';
    errorResult += `${apexClassPath}           Could not save testAPI, : managed installed classes cannot be saved\n`;
    errorResult += `${apexClassXmlPath}  Could not save testAPI, : managed installed classes cannot be saved\n`;

    const results = await parser.resultParser(failedManagedPkgDeployResult);
    expect(results).to.equal(errorResult);
  });

  it('should create a table with error results', async () => {
    const parser = new LibraryDeployResultParser(errorDeployResult);

    let errorResult = '=== Deploy Errors\n';
    errorResult +=
      'PROJECT PATH      ERRORS                                 \n';
    errorResult +=
      '────────────────  ───────────────────────────────────────\n';
    errorResult += `${apexClassPath}  Unexpected error happened during deploy\n`;

    const results = parser.resultParser(errorDeployResult);
    expect(results).to.equal(errorResult);
  });

  it('should create a table with queued results', async () => {
    const parser = new LibraryDeployResultParser(queuedDeployResult);
    const results = await parser.resultParser(queuedDeployResult);
    expect(results).to.equal(nls.localize('beta_tapi_queue_status'));
  });
});
