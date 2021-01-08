/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import {
  getDocumentName,
  trackErrorWithTelemetry
} from '../../src/commonUtils';
import { telemetryService } from '../../src/telemetry';
import { MockTextDocumentProvider } from './testUtilities';

describe('Common SOQL Builder Utilities', () => {
  let mockTextDocument: vscode.TextDocument;
  let docProviderDisposable: vscode.Disposable;
  let sandbox: sinon.SinonSandbox;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    docProviderDisposable = vscode.workspace.registerTextDocumentContentProvider(
      'sfdc-test',
      new MockTextDocumentProvider()
    );
    mockTextDocument = await vscode.workspace.openTextDocument(
      vscode.Uri.parse('sfdc-test:test/examples/soql/mocksoql.soql')
    );
  });

  afterEach(() => {
    docProviderDisposable.dispose();
    sandbox.restore();
  });

  it('gets the document name form path', () => {
    const documentName = getDocumentName(mockTextDocument);
    expect(documentName).equals('mocksoql.soql');
  });

  it('display and track error with correct telemetry namespace', async () => {
    const telemetryServiceStub = sandbox
      .stub(telemetryService, 'sendException')
      .resolves();

    const errorNamespace = 'test-me';
    const errorDetails = 'this is a test error';
    await trackErrorWithTelemetry(errorNamespace, errorDetails);

    expect(telemetryServiceStub.callCount).to.equal(1);
    expect(telemetryServiceStub.getCall(0).args[0]).to.equal(
      `soql_error_${errorNamespace}`
    );
    expect(telemetryServiceStub.getCall(0).args[1]).to.equal(errorDetails);
  });
});
