import { AuthInfo, Connection } from '@salesforce/core';
import {
  instantiateContext,
  MockTestOrgData,
  stubContext
} from '@salesforce/core/lib/testSetup';
import {
  ContinueResponse,
  TelemetryBuilder,
  WorkspaceContextUtil
} from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet } from '@salesforce/source-deploy-retrieve';
import * as fs from 'fs';
import * as path from 'path';
import { LibraryDeploySourcePathExecutor } from '../../../src/commands';
import { DeployExecutor } from '../../../src/commands/DeployExecutor';
import { workspaceContext } from '../../../src/context';
import { WorkspaceContext } from '../../../src/context/workspaceContext';
import { ComponentUtils } from '../../../src/orgBrowser';
import { SourceTrackingService } from '../../../src/services';
import SfdxProjectConfig from '../../../src/sfdxProject/sfdxProjectConfig';
import { OrgAuthInfo } from '../../../src/util';
// import { WorkspaceContext } from './../../../../salesforcedx-vscode-apex/src/context/workspaceContext';
// import { workspaceContext } from './../../../../salesforcedx-vscode-soql/src/sfdx';

// jest.mock('../../../src/services/SourceTrackingService');
// const sourceTrackingServiceMocked = jest.mocked(SourceTrackingService);

// jest.mock('../../../src/sfdxProject/sfdxProjectConfig', () => {
//   return {
//     getValue: '56.0'
//   };
// });
jest.mock('../../../src/sfdxProject/sfdxProjectConfig');
// const sfdxProjectConfigMocked = jest.mocked(SfdxProjectConfig);

jest.mock('@salesforce/source-deploy-retrieve');
const componentSetMocked = jest.mocked(ComponentSet);
// const workspaceContextMocked = jest.mocked(WorkspaceContext);
// jest.mock('../../../src/context/workspaceContext', () => {
//   return { getInstance: jest.fn() };
// });

const $$ = instantiateContext();

describe('Deploy Executor', () => {
  let mockConnection: Connection;
  // let connectionStub: jest.SpyInstance;
  // let getComponentsPathStub: jest.SpyInstance;
  let getUsernameStub: jest.SpyInstance;
  // let fileExistsStub: jest.SpyInstance;
  // let buildComponentsListStub: SinonStub;
  // let buildCustomObjectFieldsListStub: SinonStub;
  // let fetchAndSaveMetadataComponentPropertiesStub: SinonStub;
  // let fetchAndSaveSObjectFieldsPropertiesStub: SinonStub;
  const cmpUtil = new ComponentUtils();
  const defaultOrg = 'defaultOrg@test.com';
  const metadataType = 'ApexClass';
  const metadataTypeCustomObject = 'CustomObject';
  const metadataTypeStandardValueSet = 'StandardValueSet';
  const sObjectName = 'DemoCustomObject';
  const folderName = 'DemoDashboard';
  const metadataTypeDashboard = 'Dashboard';
  const filePath = '/test/metadata/ApexClass.json';
  const fileData = JSON.stringify({
    status: 0,
    result: [
      { fullName: 'fakeName2', type: 'ApexClass' },
      { fullName: 'fakeName1', type: 'ApexClass' }
    ]
  });
  // Current failure:
  /*
  FAIL  packages/salesforcedx-vscode-core/test/jest/commands/deployExecutor.test.ts
  ● Test suite failed to run

    TypeError: Cannot read properties of undefined (reading 'getInstance')

      14 | } from './workspaceOrgType';
      15 |
    > 16 | export const workspaceContext = WorkspaceContext.getInstance();
    */

  beforeEach(async () => {
    $$.init();
    // (SourceTrackingService.prototype as any).createSourceTracking.mockResolvedValue(
    //   sourceTrackingServiceMocked
    // );
    // (WorkspaceContext as any).getInstance.mockReturnValue(
    //   workspaceContextMocked
    // );
    // (WorkspaceContext.prototype as any).getConnection = jest.fn();
    // sfdxProjectConfigMocked.mockReturnValue();
    // SfdxProjectConfig.getValue.mockResolvedValue();
    // sfdxProjectConfigMocked
    jest.spyOn(SfdxProjectConfig, 'getValue').mockResolvedValue('56.0');
    jest
      .spyOn(ComponentSet, 'fromSource')
      .mockReturnValue({ sourceApiVersion: '56.0' } as any);
    const testData = new MockTestOrgData();
    await $$.stubAuths(testData);
    // mockConnection = await testData.getConnection();
    const testConnection = await Connection.create({
      authInfo: await AuthInfo.create({ username: testData.username })
    });
    console.log('created test  connection');

    // jest
    //   .spyOn(WorkspaceContextUtil.prototype, 'getConnection')
    //   .mockResolvedValue(testConnection);
    // AuthInfo.prototype.init = jest.fn();

    // jest
    //   .spyOn(WorkspaceContextUtils, 'getConnection')
    //   .mockReturnValue({ sourceApiVersion: '56.0' } as any);
    // const testData = new MockTestOrgData();
    // stubContext($$);
    // $$.setConfigStubContents('AuthInfoConfig', {
    //   contents: await testData.getConfig()
    // });
    // mockConnection = await testData.getConnection();
    // getComponentsPathStub = jest
    //   .spyOn(ComponentUtils.prototype, 'getComponentsPath')
    //   .mockResolvedValue(filePath);
    // connectionStub = jest
    //   .spyOn(workspaceContext, 'getConnection')
    //   .mockResolvedValue(mockConnection);
    // getUsernameStub = jest
    //   .spyOn(OrgAuthInfo, 'getUsername')
    //   .mockResolvedValue('test-username1@example.com');
    // fileExistsStub = jest.spyOn(fs, 'existsSync');
    // jest.spyOn(TelemetryBuilder.prototype, 'addProperty').mockReturnValue();
  });

  it('should create an instance of Source Tracking before deploying', async () => {
    // class TestDeployExecutor extends DeployExecutor<{}> {
    //   protected getComponents(
    //     response: ContinueResponse<{}>
    //   ): Promise<ComponentSet> {
    //     return new Promise(resolve => resolve(new ComponentSet()));
    //   }
    // }
    // const executor = new TestDeployExecutor('testDeploy', 'testDeployLog');
    // await executor.run({ data: {}, type: 'CONTINUE' });

    const executor = new LibraryDeploySourcePathExecutor();
    const filePath1 = path.join('classes', 'MyClass1.cls');
    const filePath2 = path.join('classes', 'MyClass2.cls');
    const filePath3 = path.join('lwc', 'myBundle', 'myBundle');

    await executor.run({
      type: 'CONTINUE',
      data: [filePath1, filePath2, filePath3]
    });
  });
});
