/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { createSandbox, SinonSandbox, SinonStub } from 'sinon';
import * as vscode from 'vscode';
import {
  forceOpenDocumentation,
  auraDocUrl,
  apexDocUrl,
  soqlDocUrl,
  lwcDocUrl,
  functionsDocUrl,
  defaultDocUrl
} from '../../../src/commands';

describe('forceOpenDocumentation', () => {
  let sb: SinonSandbox;
  let activeTextEditorStub: SinonStub;
  let openExternalStub: SinonStub;

  beforeEach(() => {
    sb = createSandbox();
    activeTextEditorStub = sb.stub(vscode.window, 'activeTextEditor');
    openExternalStub = sb.stub(vscode.env, 'openExternal');
  });

  afterEach(() => {
    sb.restore();
  });

  it('should open the documentation for Aura', async () => {
    activeTextEditorStub.get(() => ({
      document: {
        fileName:
          '/force-app/main/default/aura/exampleAuraComponent/exampleAuraComponent.cmp'
      }
    }));

    await forceOpenDocumentation();

    expect(openExternalStub.getCall(0).args[0].toString()).to.equal(auraDocUrl);
  });

  it('should open the documentation for Apex class', async () => {
    activeTextEditorStub.get(() => ({
      document: {
        fileName: '/force-app/main/default/classes/exampleApexClass.cls'
      }
    }));

    await forceOpenDocumentation();

    expect(openExternalStub.getCall(0).args[0].toString()).to.equal(apexDocUrl);
  });

  it('should open the documentation for Anonymous Apex', async () => {
    activeTextEditorStub.get(() => ({
      document: {
        fileName: '/scripts/apex/exampleApex.apex'
      }
    }));

    await forceOpenDocumentation();

    expect(openExternalStub.getCall(0).args[0].toString()).to.equal(apexDocUrl);
  });

  it('should open the documentation for SOQL', async () => {
    activeTextEditorStub.get(() => ({
      document: {
        fileName: '/scripts/soql/exampleSoql.soql'
      }
    }));

    await forceOpenDocumentation();

    expect(openExternalStub.getCall(0).args[0].toString()).to.equal(soqlDocUrl);
  });

  it('should open the documentation for LWC', async () => {
    activeTextEditorStub.get(() => ({
      document: {
        fileName:
          '/force-app/main/default/lwc/exampleLwcComponent/exampleLwcComponent.js'
      }
    }));

    await forceOpenDocumentation();

    expect(openExternalStub.getCall(0).args[0].toString()).to.equal(lwcDocUrl);
  });

  it('should open the documentation for Functions', async () => {
    activeTextEditorStub.get(() => ({
      document: {
        fileName: '/functions/example/index.js'
      }
    }));

    await forceOpenDocumentation();

    expect(openExternalStub.getCall(0).args[0].toString()).to.equal(
      functionsDocUrl
    );
  });

  it('should open the default documentation', async () => {
    activeTextEditorStub.get(() => ({
      document: {
        fileName: '/force-app/main/default/staticresources/example-image.png'
      }
    }));

    await forceOpenDocumentation();

    expect(openExternalStub.getCall(0).args[0].toString()).to.equal(
      defaultDocUrl
    );
  });
});
