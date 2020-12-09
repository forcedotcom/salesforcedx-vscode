/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Table } from '@salesforce/salesforcedx-utils-vscode/out/src/output';
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
import { outputDeployTable } from '../../../../src/commands/util/libraryDeployResultParser';
import { nls } from '../../../../src/messages';

describe('Deploy Parser', () => {
  const root = path.join(path.sep, 'path', 'to', 'project');
  const packageDirs = ['force-app', path.join('test', 'force-app2')];
  const apexClassPathOne = path.join(packageDirs[0], 'classes', 'test.cls');
  const apexClassXmlPathOne = `${apexClassPathOne}-meta.xml`;
  const apexClassPathTwo = path.join(packageDirs[1], 'classes', 'testTwo.cls');
  const apexClassXmlPathTwo = `${apexClassPathTwo}-meta.xml`;
  const lwcJsPath = path.join(packageDirs[0], 'lwc', 'test', 'test.js');
  const lwcXmlPath = `${lwcJsPath}-meta.xml`;
  const successColumns = [
    { key: 'state', label: nls.localize('table_header_state') },
    { key: 'fullName', label: nls.localize('table_header_full_name') },
    { key: 'type', label: nls.localize('table_header_type') },
    {
      key: 'filePath',
      label: nls.localize('table_header_project_path')
    }
  ];
  const failureColumns = [
    {
      key: 'filePath',
      label: nls.localize('table_header_project_path')
    },
    { key: 'error', label: nls.localize('table_header_errors') }
  ];
  const apexComponentOne = SourceComponent.createVirtualComponent(
    {
      name: 'test',
      type: registryData.types.apexclass,
      xml: path.join(root, apexClassXmlPathOne),
      content: path.join(root, apexClassPathOne)
    },
    [
      {
        dirPath: path.join(root, packageDirs[0], 'classes'),
        children: ['test.cls', 'test.cls-meta.xml']
      }
    ]
  );
  const apexComponentTwo = SourceComponent.createVirtualComponent(
    {
      name: 'test',
      type: registryData.types.apexclass,
      xml: path.join(root, apexClassXmlPathTwo),
      content: path.join(root, apexClassPathTwo)
    },
    [
      {
        dirPath: path.join(root, packageDirs[1], 'classes'),
        children: ['testTwo.cls', 'testTwo.cls-meta.xml']
      }
    ]
  );
  const lwcComponent = SourceComponent.createVirtualComponent(
    {
      name: 'test',
      type: registryData.types.lightningcomponentbundle,
      xml: path.join(root, lwcXmlPath),
      content: path.join(root, packageDirs[0], 'lwc', 'test')
    },
    [
      {
        dirPath: path.join(root, packageDirs[0], 'lwc'),
        children: ['test']
      },
      {
        dirPath: path.join(root, packageDirs[0], 'lwc', 'test'),
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
    const { fullName, type } = apexComponentOne;
    const expectedOutput = new Table().createTable(
      [
        {
          state: 'Changed',
          fullName,
          type: type.name,
          filePath: apexClassPathOne
        },
        {
          state: 'Changed',
          fullName,
          type: type.name,
          filePath: apexClassXmlPathOne
        }
      ],
      successColumns,
      nls.localize(`table_title_deployed_source`)
    );

    const results = outputDeployTable(completeApexResult, packageDirs);
    expect(results).to.equal(expectedOutput);
  });

  it('should create a table with successful results for multiple components', async () => {
    const expectedOutput = new Table().createTable(
      [
        {
          state: 'Changed',
          fullName: apexComponentOne.fullName,
          type: apexComponentOne.type.name,
          filePath: apexClassPathOne
        },
        {
          state: 'Changed',
          fullName: apexComponentOne.fullName,
          type: apexComponentOne.type.name,
          filePath: apexClassXmlPathOne
        },
        {
          state: 'Changed',
          fullName: apexComponentTwo.fullName,
          type: apexComponentTwo.type.name,
          filePath: apexClassPathTwo
        },
        {
          state: 'Changed',
          fullName: apexComponentTwo.fullName,
          type: apexComponentTwo.type.name,
          filePath: apexClassXmlPathTwo
        }
      ],
      successColumns,
      nls.localize(`table_title_deployed_source`)
    );
    const results = outputDeployTable(multipleCmpResult, packageDirs);
    expect(results).to.equal(expectedOutput);
  });

  it('should create a table with successful results for a bundle type component', async () => {
    const { fullName, type } = lwcComponent;
    const expectedOutput = new Table().createTable(
      [
        {
          state: 'Created',
          fullName,
          type: type.name,
          filePath: lwcJsPath
        },
        {
          state: 'Created',
          fullName,
          type: type.name,
          filePath: lwcXmlPath
        }
      ],
      successColumns,
      nls.localize(`table_title_deployed_source`)
    );
    const results = outputDeployTable(succeededLwcResult, packageDirs);
    expect(results).to.equal(expectedOutput);
  });

  it('should create a table with failed results', async () => {
    const expectedOutput = new Table().createTable(
      [
        {
          filePath: apexClassPathOne,
          error: "Missing ';' at '}' (4:5)"
        },
        {
          filePath: apexClassPathOne,
          error: "Extra ':' at '}' (7:9)"
        }
      ],
      failureColumns,
      nls.localize(`table_title_deploy_errors`)
    );
    const results = outputDeployTable(failedApexResult, packageDirs);
    expect(results).to.equal(expectedOutput);
  });

  it('should create a table with failures that do not have line and column info', async () => {
    const expectedOutput = new Table().createTable(
      [
        {
          filePath: apexClassPathOne,
          error: 'Unexpected error happened during deploy'
        }
      ],
      failureColumns,
      nls.localize(`table_title_deploy_errors`)
    );
    const results = outputDeployTable(errorDeployResult, packageDirs);
    expect(results).to.equal(expectedOutput);
  });

  it('should create a table with queued results', async () => {
    const results = outputDeployTable(queuedDeployResult, packageDirs);
    expect(results).to.equal(nls.localize('beta_tapi_queue_status'));
  });
});
