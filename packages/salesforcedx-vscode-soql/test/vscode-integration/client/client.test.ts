/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as path from 'path';
import * as sinon from 'sinon';
import { extensions, languages, Uri, window, workspace } from 'vscode';
import { clearDiagnostics } from '../../../src/client/client';
import { getMockConnection, MockConnection } from '../testUtilities';
import * as vscode from 'vscode';

const sfdxCoreExtension = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
);
const sfdxCoreExports = sfdxCoreExtension?.exports;
const { workspaceContext } = sfdxCoreExports;

async function sleep(ms: number = 0) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

function waitUntil(predicate: () => boolean) {
  return new Promise<void>(async resolve => {
    let notFound = true;
    let tries = 5;
    while (notFound || tries-- > 0) {
      await sleep(50);
      notFound = !predicate();
    }
    resolve();
  });
}

describe('SOQL language client', () => {
  let sandbox: sinon.SinonSandbox;
  let workspacePath: string;
  let soqlFileUri: Uri;
  const encoder = new TextEncoder();
  let mockConnection: MockConnection;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    mockConnection = getMockConnection(sandbox);
    sandbox.stub(workspaceContext, 'getConnection').returns(mockConnection);
    workspacePath = workspace.workspaceFolders![0].uri.fsPath;
    soqlFileUri = Uri.file(path.join(workspacePath, 'test.soql'));
    const ext = extensions.getExtension('salesforce.salesforcedx-vscode-soql')!;
    await ext.activate();
    clearDiagnostics();
  });

  afterEach(async () => {
    sandbox.restore();
    await workspace.fs.delete(soqlFileUri);
  });

  it('should show diagnostics for syntax error', async () => {
    await workspace.fs.writeFile(
      soqlFileUri,
      encoder.encode(`
      SELECT Id
      FRM Account
    `)
    );
    await window.showTextDocument(soqlFileUri);

    const diagnostics = languages.getDiagnostics(soqlFileUri);
    expect(diagnostics)
      .to.be.an('array')
      .to.have.lengthOf(1);
    expect(diagnostics[0].message).to.equal(`missing 'from' at 'Account'`);
  });

  it('should create diagnostics based off of limit 0 execute error results', async () => {
    const expectedError = `SELECT Ids FROM ACCOUNT\nERROR at Row:1:Column:8\nSome error at 'Ids'`;
    await workspace.fs.writeFile(
      soqlFileUri,
      encoder.encode(`
      SELECT Ids
      FROM Account
    `)
    );

    sandbox.stub(mockConnection, 'query').throws({
      name: 'INVALID_FIELD',
      errorCode: 'INVALID_FIELD',
      message: expectedError
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
