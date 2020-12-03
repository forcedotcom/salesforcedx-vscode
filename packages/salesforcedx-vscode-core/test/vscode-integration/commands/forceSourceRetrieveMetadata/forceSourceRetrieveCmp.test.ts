/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, ConfigAggregator, Connection } from '@salesforce/core';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { CommandOutput } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  ContinueResponse,
  LocalComponent
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import {
  ComponentSet,
  registryData,
  SourceComponent
} from '@salesforce/source-deploy-retrieve';
import { expect } from 'chai';
import * as path from 'path';
import { createSandbox, SinonSandbox, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import { RetrieveDescriber } from '../../../../src/commands/forceSourceRetrieveMetadata';
import {
  ForceSourceRetrieveExecutor,
  LibraryRetrieveSourcePathExecutor
} from '../../../../src/commands/forceSourceRetrieveMetadata/forceSourceRetrieveCmp';
import { workspaceContext } from '../../../../src/context';
import { SfdxPackageDirectories } from '../../../../src/sfdxProject';
import { telemetryService } from '../../../../src/telemetry';
import { getRootWorkspacePath } from '../../../../src/util';

const $$ = testSetup();

class TestDescriber implements RetrieveDescriber {
  public buildMetadataArg(data?: LocalComponent[]): string {
    return data ? `${data[0].type}:${data[0].fileName}` : 'TestType:Test1';
  }

  public gatherOutputLocations(): Promise<LocalComponent[]> {
    throw new Error('Method not implemented.');
  }
}

describe('Force Source Retrieve', () => {
  const forceSourceRetrieveExec = new ForceSourceRetrieveExecutor(
    new TestDescriber()
  );
  it('Should build source retrieve command', async () => {
    const forceSourceRetrieveCmd = forceSourceRetrieveExec.build();
    expect(forceSourceRetrieveCmd.toCommand()).to.equal(
      `sfdx force:source:retrieve --json --loglevel fatal -m TestType:Test1`
    );
  });

  it('Should pass optional data to describer', () => {
    const data = [{ fileName: 'Test2', outputdir: '', type: 'TestType2' }];
    const forceSourceRetrieveCmd = forceSourceRetrieveExec.build(data);
    expect(forceSourceRetrieveCmd.toCommand()).to.equal(
      `sfdx force:source:retrieve --json --loglevel fatal -m TestType2:Test2`
    );
  });
});

describe('Force Source Retrieve and open', () => {
  let sb: SinonSandbox;
  const openAfterRetrieve: boolean = true;
  const forceSourceRetrieveExec = new ForceSourceRetrieveExecutor(
    new TestDescriber(),
    openAfterRetrieve
  );
  let openTextDocumentStub: SinonStub;
  let showTextDocumentStub: SinonStub;
  const resultData = `{
    "status": 0,
    "result": {
      "inboundFiles": [
        {
          "state": "Add",
          "fullName": "TestClass",
          "type": "ApexClass",
          "filePath": "force-app/main/default/classes/TestClass.cls"}
  ] }}`;
  let getCmdResultStub: SinonStub;

  beforeEach(() => {
    sb = createSandbox();
    openTextDocumentStub = sb.stub(vscode.workspace, 'openTextDocument');
    showTextDocumentStub = sb.stub(vscode.window, 'showTextDocument');
    getCmdResultStub = sb
      .stub(CommandOutput.prototype, 'getCmdResult')
      .returns(resultData);
  });

  afterEach(() => {
    sb.restore();
  });

  it('Should build source retrieve command', async () => {
    const response = [
      {
        type: 'CONTINUE',
        data: [
          {
            fileName: 'DemoController',
            outputdir:
              '/Users/testUser/testProject/force-app/main/default/classes/DemoController.cls',
            type: 'ApexClass',
            suffix: 'cls'
          }
        ]
      }
    ];
    const exeEesponse = await forceSourceRetrieveExec.execute(response);
    expect(getCmdResultStub.called).to.equal(true);
    expect(openTextDocumentStub.called).to.equal(true);
    expect(showTextDocumentStub.called).to.equal(true);
  });

  it('Should retrieve resource witout defined file extensions', async () => {
    const response = [
      {
        type: 'CONTINUE',
        data: [
          {
            fileName: 'Account',
            outputdir:
              '/Users/testUser/testProject/force-app/main/default/classes/Account.object-meta.xml',
            type: 'customobject',
            suffix: 'object',
            directory: 'objects'
          }
        ]
      }
    ];
    const exeEesponse = await forceSourceRetrieveExec.execute(response);
    expect(getCmdResultStub.called).to.equal(true);
    expect(openTextDocumentStub.called).to.equal(true);
    expect(showTextDocumentStub.called).to.equal(true);
  });
});

describe('Source Retrieve Using Library', () => {
  const testData = new MockTestOrgData();

  let mockConnection: Connection;
  let sb: SinonSandbox;
  const openAfterRetrieve: boolean = false;
  const libSourceRetrieveExec = new LibraryRetrieveSourcePathExecutor(
    openAfterRetrieve
  );
  let sendCommandEventStub: SinonStub;
  let openTextDocumentStub: SinonStub;
  let showTextDocumentStub: SinonStub;

  beforeEach(async () => {
    sb = createSandbox();
    $$.setConfigStubContents('AuthInfoConfig', {
      contents: await testData.getConfig()
    });
    mockConnection = await Connection.create({
      authInfo: await AuthInfo.create({
        username: testData.username
      })
    });
    sb.stub(ConfigAggregator.prototype, 'getPropertyValue')
      .withArgs('defaultusername')
      .returns(testData.username);

    openTextDocumentStub = sb.stub(vscode.workspace, 'openTextDocument');
    showTextDocumentStub = sb.stub(vscode.window, 'showTextDocument');
  });

  afterEach(() => {
    $$.SANDBOX.restore();
    sb.restore();
  });

  it('should retrieve metadata', async () => {
    const telemetryProps = {
      metadataCount: '[{"type":"ApexClass","quantity":2}]',
      success: 'true'
    };
    const packageDirStub = sb
      .stub(SfdxPackageDirectories, 'getDefaultPackageDir')
      .returns('test-app');
    sb.stub(workspaceContext, 'getConnection').returns(mockConnection);
    const retrieveStub = sb
      .stub(ComponentSet.prototype, 'retrieve')
      .returns({ success: true });
    sendCommandEventStub = sb.stub(telemetryService, 'sendCommandEvent');

    const response: ContinueResponse<LocalComponent[]> = {
      type: 'CONTINUE',
      data: [
        { fileName: 'MyClassA', type: 'ApexClass', outputdir: 'out' },
        { fileName: 'MyClassB', type: 'ApexClass', outputdir: 'out' }
      ]
    };

    await libSourceRetrieveExec.execute(response);

    expect(sendCommandEventStub.called).to.equal(true);
    const { args } = sendCommandEventStub.getCall(0);
    expect(args[0]).to.equal(
      // @ts-ignore allow public getter for testing
      libSourceRetrieveExec.logName
    );
    expect(args[2]).to.eql(telemetryProps);

    expect(openTextDocumentStub.called).to.equal(false);
    expect(showTextDocumentStub.called).to.equal(false);
  });
});

describe('Source Retrieve and Open Using Library', () => {
  // const $$ = testSetup();
  const testData = new MockTestOrgData();

  let mockConnection: Connection;
  let sb: SinonSandbox;
  const openAfterRetrieve: boolean = true;
  const libSourceRetrieveExec = new LibraryRetrieveSourcePathExecutor(
    openAfterRetrieve
  );
  let sendCommandEventStub: SinonStub;
  let openTextDocumentStub: SinonStub;
  let showTextDocumentStub: SinonStub;

  beforeEach(async () => {
    sb = createSandbox();
    $$.setConfigStubContents('AuthInfoConfig', {
      contents: await testData.getConfig()
    });
    mockConnection = await Connection.create({
      authInfo: await AuthInfo.create({
        username: testData.username
      })
    });
    sb.stub(ConfigAggregator.prototype, 'getPropertyValue')
      .withArgs('defaultusername')
      .returns(testData.username);

    openTextDocumentStub = sb.stub(vscode.workspace, 'openTextDocument');
    showTextDocumentStub = sb.stub(vscode.window, 'showTextDocument');
  });

  afterEach(() => {
    $$.SANDBOX.restore();
    sb.restore();
  });

  it('should retrieve metadata and open it', async () => {
    const telemetryProps = {
      metadataCount: '[{"type":"ApexClass","quantity":1}]',
      success: 'true'
    };
    const packageDirStub = sb
      .stub(SfdxPackageDirectories, 'getDefaultPackageDir')
      .returns('test-app');
    sb.stub(workspaceContext, 'getConnection').returns(mockConnection);
    const retrieveStub = sb
      .stub(ComponentSet.prototype, 'retrieve')
      .returns({ success: true });
    const retrievePath = path.join(getRootWorkspacePath(), 'test-app');
    sendCommandEventStub = sb.stub(telemetryService, 'sendCommandEvent');

    const apexClass = 'MyClassB';
    const response: ContinueResponse<LocalComponent[]> = {
      type: 'CONTINUE',
      data: [{ fileName: apexClass, type: 'ApexClass', outputdir: 'out' }]
    };

    const apexClassPathOne = path.join('classes', `${apexClass}.cls`);
    const apexClassXmlPathOne = `${apexClassPathOne}-meta.xml`;
    const testComponents = [
      SourceComponent.createVirtualComponent(
        {
          name: apexClass,
          type: registryData.types.apexclass,
          xml: apexClassXmlPathOne,
          content: apexClassPathOne
        },
        [
          {
            dirPath: 'classes',
            children: [`${apexClass}.cls`, `${apexClass}.cls-meta.xml`]
          }
        ]
      )
    ];

    const components = new ComponentSet(testComponents);
    const getComponentsStub = sb.stub(ComponentSet, 'fromSource');
    getComponentsStub.withArgs(retrievePath).returns(components);

    await libSourceRetrieveExec.execute(response);

    expect(sendCommandEventStub.called).to.equal(true);
    const { args } = sendCommandEventStub.getCall(0);
    expect(args[0]).to.equal(
      // @ts-ignore allow public getter for testing
      libSourceRetrieveExec.logName
    );
    expect(args[2]).to.eql(telemetryProps);

    // expect(getComponentsStub.calledWith(retrievePath)).to.equal(true);
    expect(openTextDocumentStub.called).to.equal(true);
    expect(showTextDocumentStub.called).to.equal(true);

    expect(openTextDocumentStub.callCount).to.equal(2);
    let callArgs = openTextDocumentStub.getCall(0).args;
    expect(callArgs[0]).to.equal(apexClassXmlPathOne);

    callArgs = openTextDocumentStub.getCall(1).args;
    expect(callArgs[0]).to.equal(apexClassPathOne);
  });
});
