/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as path from 'path';
import { createSandbox, SinonSandbox } from 'sinon';
import * as vscode from 'vscode';
import {
  ForceSourceDeploySourcePathExecutor
} from '../../../src/commands/forceSourceDeploySourcePath';
import { nls } from '../../../src/messages';
import { SfdxCoreSettings } from '../../../src/settings/sfdxCoreSettings';
import { RegistryAccess, registryData } from '@salesforce/source-deploy-retrieve';
import sinon = require('sinon');
import { MetadataComponent } from '@salesforce/source-deploy-retrieve/lib/types';
import { useBetaDeployRetrieve } from '../../../src/commands/util/useBetaDeployRetrieve';

describe('Force Source Deploy Using Sourcepath Option', () => {
  let sandboxStub: SinonSandbox;

  beforeEach(() => {
    sandboxStub = createSandbox();
  });

  afterEach(() => {
    sandboxStub.restore();
  });

  it('Should build the source deploy command for', () => {
    const sourcePath = path.join('path', 'to', 'sourceFile');
    const sourceDeploy = new ForceSourceDeploySourcePathExecutor();
    const sourceDeployCommand = sourceDeploy.build(sourcePath);

    expect(sourceDeployCommand.toCommand()).to.equal(
      `sfdx force:source:deploy --sourcepath ${sourcePath} --json --loglevel fatal`
    );
    expect(sourceDeployCommand.description).to.equal(
      nls.localize('force_source_deploy_text')
    );
  });

  it('Should return false for multiple valid URI when beta configuration is enabled', () => {
    sandboxStub
      .stub(SfdxCoreSettings.prototype, 'getBetaDeployRetrieve')
      .returns(true);
    const uriOne = vscode.Uri.parse('file:///bar.cls');
    const uriTwo = vscode.Uri.parse('file:///bar.trigger');
    const multipleFileProcessing = useBetaDeployRetrieve([uriOne, uriTwo]);
    expect(multipleFileProcessing).to.equal(false);
  });

  it('Should return false for URI not part of the beta when the beta configuration is enabled', () => {
    sandboxStub
      .stub(SfdxCoreSettings.prototype, 'getBetaDeployRetrieve')
      .returns(true);
    const getFilesStub = sandboxStub.stub(RegistryAccess.prototype, 'getComponentsFromPath');
    const components: MetadataComponent[] = [
      {
        fullName: 'bar',
        type: registryData.types.lightningcomponentbundle,
        xml: 'bar.js-meta.xml',
        sources: ['bar.js', 'bar.html', 'bar.js-meta.xml']
      }
    ];
    ;
    getFilesStub.returns(components);
    const uriOne = vscode.Uri.parse('file:///bar.html');
    const fileProcessing = useBetaDeployRetrieve([uriOne]);
    expect(fileProcessing).to.equal(true);
    getFilesStub.restore()
  });

  it('Should return true for ApexClass URI when beta configuration is enabled', () => {
    sandboxStub
      .stub(SfdxCoreSettings.prototype, 'getBetaDeployRetrieve')
      .returns(true);
    const uriOne = vscode.Uri.parse('file:///bar.cls');
    const apexClassProcessing = useBetaDeployRetrieve([uriOne]);
    expect(apexClassProcessing).to.equal(true);

    const uriTwo = vscode.Uri.parse('file:///bar.cls-meta.xml');
    const apexClassMetaProcessing = useBetaDeployRetrieve([uriTwo]);
    expect(apexClassMetaProcessing).to.equal(true);
  });

  it('Should return false for ApexClass URI when beta configuration is disabled', () => {
    sandboxStub
      .stub(SfdxCoreSettings.prototype, 'getBetaDeployRetrieve')
      .returns(false);
    const uriOne = vscode.Uri.parse('file:///bar.cls');
    const apexClassProcessing = useBetaDeployRetrieve([uriOne]);
    expect(apexClassProcessing).to.equal(false);

    const uriTwo = vscode.Uri.parse('file:///bar.cls-meta.xml');
    const apexClassMetaProcessing = useBetaDeployRetrieve([uriTwo]);
    expect(apexClassMetaProcessing).to.equal(false);
  });

  it('Should return true for ApexTrigger URI when beta configuration is enabled', () => {
    sandboxStub
      .stub(SfdxCoreSettings.prototype, 'getBetaDeployRetrieve')
      .returns(true);
    const uriOne = vscode.Uri.parse('file:///bar.trigger');
    const triggerProcessing = useBetaDeployRetrieve([uriOne]);
    expect(triggerProcessing).to.equal(true);

    const uriTwo = vscode.Uri.parse('file:///bar.trigger-meta.xml');
    const triggerMetaProcessing = useBetaDeployRetrieve([uriTwo]);
    expect(triggerMetaProcessing).to.equal(true);
  });

  it('Should return false for ApexTrigger URI when beta configuration is disabled', () => {
    sandboxStub
      .stub(SfdxCoreSettings.prototype, 'getBetaDeployRetrieve')
      .returns(false);
    const uriOne = vscode.Uri.parse('file:///bar.trigger');
    const triggerProcessing = useBetaDeployRetrieve([uriOne]);
    expect(triggerProcessing).to.equal(false);

    const uriTwo = vscode.Uri.parse('file:///bar.trigger-meta.xml');
    const triggerMetaProcessing = useBetaDeployRetrieve([uriTwo]);
    expect(triggerMetaProcessing).to.equal(false);
  });

  it('Should return true for VF Page URI when beta configuration is enabled', () => {
    sandboxStub
      .stub(SfdxCoreSettings.prototype, 'getBetaDeployRetrieve')
      .returns(true);
    const uriOne = vscode.Uri.parse('file:///bar.page');
    const pageProcessing = useBetaDeployRetrieve([uriOne]);
    expect(pageProcessing).to.equal(true);

    const uriTwo = vscode.Uri.parse('file:///bar.page-meta.xml');
    const pageMetaProcessing = useBetaDeployRetrieve([uriTwo]);
    expect(pageMetaProcessing).to.equal(true);
  });

  it('Should return false for VF Page URI when beta configuration is disabled', () => {
    sandboxStub
      .stub(SfdxCoreSettings.prototype, 'getBetaDeployRetrieve')
      .returns(false);
    const uriOne = vscode.Uri.parse('file:///bar.page');
    const pageProcessing = useBetaDeployRetrieve([uriOne]);
    expect(pageProcessing).to.equal(false);

    const uriTwo = vscode.Uri.parse('file:///bar.page-meta.xml');
    const pageMetaProcessing = useBetaDeployRetrieve([uriTwo]);
    expect(pageMetaProcessing).to.equal(false);
  });

  it('Should return true for VF Component URI when beta configuration is enabled', () => {
    sandboxStub
      .stub(SfdxCoreSettings.prototype, 'getBetaDeployRetrieve')
      .returns(true);
    const uriOne = vscode.Uri.parse('file:///bar.component');
    const cmpProcessing = useBetaDeployRetrieve([uriOne]);
    expect(cmpProcessing).to.equal(true);

    const uriTwo = vscode.Uri.parse('file:///bar.component-meta.xml');
    const cmpMetaProcessing = useBetaDeployRetrieve([uriTwo]);
    expect(cmpMetaProcessing).to.equal(true);
  });

  it('Should return false for VF Component URI when beta configuration is disabled', () => {
    sandboxStub
      .stub(SfdxCoreSettings.prototype, 'getBetaDeployRetrieve')
      .returns(false);
    const uriOne = vscode.Uri.parse('file:///bar.component');
    const cmpProcessing = useBetaDeployRetrieve([uriOne]);
    expect(cmpProcessing).to.equal(false);

    const uriTwo = vscode.Uri.parse('file:///bar.component-meta.xml');
    const cmpMetaProcessing = useBetaDeployRetrieve([uriTwo]);
    expect(cmpMetaProcessing).to.equal(false);
  });
});
