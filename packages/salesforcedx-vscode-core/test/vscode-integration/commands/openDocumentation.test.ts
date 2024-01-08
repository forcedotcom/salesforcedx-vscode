/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { createSandbox, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import { openDocumentation } from '../../../src/commands';
import { nls } from '../../../src/messages';

const sb = createSandbox();

describe('openDocumentation', () => {
  let activeTextEditorStub: SinonStub;
  let openExternalStub: SinonStub;

  beforeEach(() => {
    activeTextEditorStub = sb.stub(vscode.window, 'activeTextEditor');
    openExternalStub = sb.stub(vscode.env, 'openExternal');
  });

  afterEach(() => {
    sb.restore();
  });

  it('should open the documentation for Aura', async () => {
    const auraDocUrl = nls.localize('aura_doc_url');

    activeTextEditorStub.get(() => ({
      document: {
        fileName:
          '/force-app/main/default/aura/exampleAuraComponent/exampleAuraComponent.cmp'
      }
    }));

    await openDocumentation();

    expect(openExternalStub.getCall(0).args[0].toString()).to.equal(auraDocUrl);
  });

  it('should open the documentation for Apex class', async () => {
    const apexDocUrl = nls.localize('apex_doc_url');

    activeTextEditorStub.get(() => ({
      document: {
        fileName: '/force-app/main/default/classes/exampleApexClass.cls'
      }
    }));

    await openDocumentation();

    expect(openExternalStub.getCall(0).args[0].toString()).to.equal(apexDocUrl);
  });

  it('should open the documentation for Anonymous Apex', async () => {
    const apexDocUrl = nls.localize('apex_doc_url');

    activeTextEditorStub.get(() => ({
      document: {
        fileName: '/scripts/apex/exampleApex.apex'
      }
    }));

    await openDocumentation();

    expect(openExternalStub.getCall(0).args[0].toString()).to.equal(apexDocUrl);
  });

  it('should open the documentation for SOQL', async () => {
    const soqlDocUrl = nls.localize('soql_doc_url');

    activeTextEditorStub.get(() => ({
      document: {
        fileName: '/scripts/soql/exampleSoql.soql'
      }
    }));

    await openDocumentation();

    expect(openExternalStub.getCall(0).args[0].toString()).to.equal(soqlDocUrl);
  });

  it('should open the documentation for LWC', async () => {
    const lwcDocUrl = nls.localize('lwc_doc_url');

    activeTextEditorStub.get(() => ({
      document: {
        fileName:
          '/force-app/main/default/lwc/exampleLwcComponent/exampleLwcComponent.js'
      }
    }));

    await openDocumentation();

    expect(openExternalStub.getCall(0).args[0].toString()).to.equal(lwcDocUrl);
  });

  it('should open the documentation for Functions', async () => {
    const functionsDocUrl = nls.localize('functions_doc_url');

    activeTextEditorStub.get(() => ({
      document: {
        fileName: '/functions/example/index.js'
      }
    }));

    await openDocumentation();

    expect(openExternalStub.getCall(0).args[0].toString()).to.equal(
      functionsDocUrl
    );
  });

  it('should open the default documentation', async () => {
    const defaultDocUrl = nls.localize('default_doc_url');

    activeTextEditorStub.get(() => ({
      document: {
        fileName: '/force-app/main/default/staticresources/example-image.png'
      }
    }));

    await openDocumentation();

    expect(openExternalStub.getCall(0).args[0].toString()).to.equal(
      defaultDocUrl
    );
  });
});
