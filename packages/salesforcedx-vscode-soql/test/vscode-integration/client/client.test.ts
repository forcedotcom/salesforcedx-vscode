/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as path from 'path';
import * as sinon from 'sinon';
import { stubInterface } from '@salesforce/ts-sinon';

import {
  extensions,
  languages,
  TextEditor,
  Uri,
  window,
  workspace,
  WorkspaceConfiguration,
  commands
} from 'vscode';
import { clearDiagnostics } from '../../../src/lspClient/client';
import { stubMockConnection } from '../testUtilities';
import {
  SOQL_CONFIGURATION_NAME,
  SOQL_VALIDATION_CONFIG
} from '../../../src/constants';
import { Connection } from '@salesforce/core';

async function sleep(ms: number = 0) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

function waitUntil(predicate: () => boolean) {
  return new Promise<void>(async resolve => {
    for (let tries = 5; !predicate() && tries > 0; tries--) {
      await sleep(50);
    }
    resolve();
  });
}

describe('SOQL language client', () => {
  let sandbox: sinon.SinonSandbox;
  let soqlFileUri: Uri;
  let textEditor: TextEditor;
  let mockConnection: Connection;
  let soqlExtension: any;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    mockConnection = stubMockConnection(sandbox);
    soqlExtension = extensions.getExtension(
      'salesforce.salesforcedx-vscode-soql'
    )!;
    await soqlExtension.activate();
    clearDiagnostics();
  });

  afterEach(async () => {
    sandbox.restore();
    commands.executeCommand('workbench.action.closeActiveEditor');
    await workspace.fs.delete(soqlFileUri);
  });

  it('should show diagnostics for syntax error', async () => {
    soqlFileUri = await writeSOQLFile(
      'testSyntaxError',
      `SELECT Id
      FRM Account
      `
    );
    await window.showTextDocument(soqlFileUri);

    const diagnostics = languages.getDiagnostics(soqlFileUri);
    expect(diagnostics)
      .to.be.an('array')
      .to.have.lengthOf(1);
    expect(diagnostics[0].message).to.equal(`missing 'from' at 'Account'`);
  });

  it('should not create diagnostics based off of remote query validation by default', async () => {
    soqlFileUri = await writeSOQLFile(
      'testSemanticErrors_remoteRunDefault',
      'SELECT Ids FROM Account'
    );
    stubSOQLExtensionConfiguration(
      sandbox,
      {
        // [SOQL_VALIDATION_CONFIG]: undefined
      },
      soqlExtension
    );

    const querySpy = sandbox.stub(mockConnection, 'query');
    textEditor = await window.showTextDocument(soqlFileUri);

    await sleep(100);

    expect(querySpy.notCalled).to.be.true;
    const diagnostics = languages.getDiagnostics(soqlFileUri);
    expect(diagnostics)
      .to.be.an('array')
      .to.have.lengthOf(0);
  });

  it('should not create diagnostics based off of remote query validation when disabled', async () => {
    soqlFileUri = await writeSOQLFile(
      'testSemanticErrors_remoteRunDisabled',
      'SELECT Ids FROM Account'
    );

    stubSOQLExtensionConfiguration(
      sandbox,
      {
        [SOQL_VALIDATION_CONFIG]: false
      },
      soqlExtension
    );

    const serverError = `SELECT Ids FROM ACCOUNT\nERROR at Row:1:Column:8\nSome error at 'Ids'`;
    const querySpy = sandbox.stub(mockConnection, 'query').throws({
      name: 'INVALID_FIELD',
      errorCode: 'INVALID_FIELD',
      message: serverError
    });
    await window.showTextDocument(soqlFileUri);

    await sleep(100);

    expect(querySpy.notCalled).to.be.true;
    const diagnostics = languages.getDiagnostics(soqlFileUri);
    expect(diagnostics)
      .to.be.an('array')
      .to.have.lengthOf(0);
  });

  it('should create diagnostics based off of remote query validation when Enabled', async () => {
    soqlFileUri = await writeSOQLFile(
      'testSemanticErrors_remoteRunEnabled',
      'SELECT Ids FROM Account'
    );

    stubSOQLExtensionConfiguration(
      sandbox,
      {
        [SOQL_VALIDATION_CONFIG]: true
      },
      soqlExtension
    );

    const serverError = `SELECT Ids FROM ACCOUNT\nERROR at Row:1:Column:8\nSome error at 'Ids'`;
    const expectedError = `SELECT Ids FROM ACCOUNT\nError:\nSome error at 'Ids'`;

    sandbox.stub(mockConnection, 'query').throws({
      name: 'INVALID_FIELD',
      errorCode: 'INVALID_FIELD',
      message: serverError
    });

    await window.showTextDocument(soqlFileUri);

    await waitUntil(() => {
      return languages.getDiagnostics(soqlFileUri).length > 0;
    });
    const diagnostics = languages.getDiagnostics(soqlFileUri);
    expect(diagnostics)
      .to.be.an('array')
      .to.have.lengthOf(1);
    expect(diagnostics[0].message).to.equal(expectedError);
    expect(diagnostics[0].range.start.line).to.equal(0, 'range start line');
    expect(diagnostics[0].range.start.character).to.equal(
      7,
      'range start char'
    );
    expect(diagnostics[0].range.end.line).to.equal(0, 'range end line');
    expect(diagnostics[0].range.end.character).to.equal(10, 'range end char');
  });
});

function generateRandomInt() {
  return Math.floor(Math.random() * Math.floor(Number.MAX_SAFE_INTEGER));
}

async function writeSOQLFile(baseName: string, content: string): Promise<Uri> {
  const fileName = `${baseName}_${generateRandomInt()}.soql`;
  const workspacePath = workspace.workspaceFolders![0].uri.fsPath;
  const encoder = new TextEncoder();
  const fileUri = Uri.file(path.join(workspacePath, fileName));
  await workspace.fs.writeFile(fileUri, encoder.encode(content));

  return fileUri;
}

function stubSOQLExtensionConfiguration(
  sandbox: sinon.SinonSandbox,
  configValues: { [key: string]: any },
  extension: any
) {
  const mockConfiguration = stubInterface<WorkspaceConfiguration>(sandbox, {
    get: (key: string) => configValues[key]
  });

  expect(
    Object.keys(extension.packageJSON.contributes.configuration.properties)
  ).to.contain(SOQL_CONFIGURATION_NAME + '.' + SOQL_VALIDATION_CONFIG);
  sandbox.stub(workspace, 'getConfiguration').returns(mockConfiguration);
}
