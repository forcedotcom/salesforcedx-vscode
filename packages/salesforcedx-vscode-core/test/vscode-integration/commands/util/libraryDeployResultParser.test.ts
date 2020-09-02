/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ComponentStatus,
  DeployStatus,
  registryData,
  SourceComponent,
  SourceDeployResult,
  ToolingDeployStatus
} from '@salesforce/source-deploy-retrieve';
import { expect } from 'chai';
import * as path from 'path';
import { LibraryDeployResultParser } from '../../../../src/commands/util';
import { nls } from '../../../../src/messages';

describe('Deploy Parser', () => {
  const apexClassPathOne = path.join('classes', 'test.cls');
  const apexClassXmlPathOne = `${apexClassPathOne}-meta.xml`;
  const apexClassPathTwo = path.join('classes', 'testTwo.cls');
  const apexClassXmlPathTwo = `${apexClassPathTwo}-meta.xml`;
  const lwcJsPath = path.join('lwc', 'test', 'test.js');
  const lwcXmlPath = `${lwcJsPath}-meta.xml`;
  const apexComponentOne = SourceComponent.createVirtualComponent(
    {
      name: 'test',
      type: registryData.types.apexclass,
      xml: apexClassXmlPathOne,
      content: apexClassPathOne
    },
    [
      {
        dirPath: 'classes',
        children: ['test.cls', 'test.cls-meta.xml']
      }
    ]
  );
  const apexComponentTwo = SourceComponent.createVirtualComponent(
    {
      name: 'test',
      type: registryData.types.apexclass,
      xml: apexClassXmlPathTwo,
      content: apexClassPathTwo
    },
    [
      {
        dirPath: 'classes',
        children: ['testTwo.cls', 'testTwo.cls-meta.xml']
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
        component: apexComponentOne,
        status: ComponentStatus.Changed,
        diagnostics: []
      }
    ]
  };
  const multipleCmpResult: SourceDeployResult = {
    success: true,
    id: '',
    status: ToolingDeployStatus.Completed,
    components: [
      {
        component: apexComponentOne,
        status: ComponentStatus.Changed,
        diagnostics: []
      },
      {
        component: apexComponentTwo,
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
        component: apexComponentOne,
        status: ComponentStatus.Created,
        diagnostics: [
          {
            lineNumber: 4,
            columnNumber: 5,
            filePath: apexClassPathOne,
            message: "Missing ';' at '}'",
            type: 'Error'
          },
          {
            lineNumber: 7,
            columnNumber: 9,
            filePath: apexClassPathOne,
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
        component: apexComponentOne,
        status: ComponentStatus.Created,
        diagnostics: [
          {
            filePath: apexClassPathOne,
            message:
              'Could not save testAPI, : managed installed classes cannot be saved',
            type: 'Error'
          }
        ]
      },
      {
        component: apexComponentOne,
        status: ComponentStatus.Failed,
        diagnostics: [
          {
            filePath: apexClassXmlPathOne,
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
        component: apexComponentOne,
        status: ComponentStatus.Failed,
        diagnostics: [
          {
            type: 'Error',
            filePath: apexClassPathOne,
            message: 'Unexpected error happened during deploy'
          }
        ]
      }
    ]
  };

  it('should create a table with successful results', async () => {
    const parser = new LibraryDeployResultParser(completeApexResult);
    const { fullName } = apexComponentOne;

    let mockResult = '=== Deployed Source\n';
    mockResult += 'STATE    FULL NAME  TYPE       PROJECT PATH             \n';
    mockResult += '───────  ─────────  ─────────  ─────────────────────────\n';
    mockResult += `Changed  ${fullName}       ApexClass  ${apexClassPathOne}         \n`;
    mockResult += `Changed  ${fullName}       ApexClass  ${apexClassXmlPathOne}\n`;

    const results = parser.resultParser(completeApexResult);
    expect(results).to.equal(mockResult);
  });

  it('should create a table with successful results for multiple components', async () => {
    const parser = new LibraryDeployResultParser(completeApexResult);
    const { fullName } = apexComponentOne;

    let mockResult = '=== Deployed Source\n';
    mockResult += 'STATE    FULL NAME  TYPE       PROJECT PATH                ';
    mockResult +=
      '\n───────  ─────────  ─────────  ────────────────────────────\n';
    mockResult += `Changed  ${fullName}       ApexClass  ${apexClassPathOne}            \n`;
    mockResult += `Changed  ${fullName}       ApexClass  ${apexClassXmlPathOne}   \n`;
    mockResult += `Changed  ${fullName}       ApexClass  ${apexClassPathTwo}         \n`;
    mockResult += `Changed  ${fullName}       ApexClass  ${apexClassXmlPathTwo}\n`;

    const results = parser.resultParser(multipleCmpResult);
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
    errorResult += `${apexClassPathOne}  Missing ';' at '}' (4:5)\n`;
    errorResult += `${apexClassPathOne}  Extra ':' at '}' (7:9)  \n`;

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
    errorResult += `${apexClassPathOne}           Could not save testAPI, : managed installed classes cannot be saved\n`;
    errorResult += `${apexClassXmlPathOne}  Could not save testAPI, : managed installed classes cannot be saved\n`;

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
    errorResult += `${apexClassPathOne}  Unexpected error happened during deploy\n`;

    const results = parser.resultParser(errorDeployResult);
    expect(results).to.equal(errorResult);
  });

  it('should create a table with queued results', async () => {
    const parser = new LibraryDeployResultParser(queuedDeployResult);
    const results = await parser.resultParser(queuedDeployResult);
    expect(results).to.equal(nls.localize('beta_tapi_queue_status'));
  });
});
