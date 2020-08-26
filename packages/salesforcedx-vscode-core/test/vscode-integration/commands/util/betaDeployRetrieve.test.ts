/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  RegistryAccess,
  registryData
} from '@salesforce/source-deploy-retrieve';
import { SourceComponent } from '@salesforce/source-deploy-retrieve';
import { MetadataType } from '@salesforce/source-deploy-retrieve/lib/src/common';
import { expect } from 'chai';
import { join } from 'path';
import { createSandbox, SinonSandbox } from 'sinon';
import * as vscode from 'vscode';
import {
  createComponentCount,
  useBetaDeployRetrieve
} from '../../../../src/commands/util';
import { SfdxCoreSettings } from '../../../../src/settings/sfdxCoreSettings';

function createComponent(type: MetadataType, ext: string, extrafile?: string) {
  const props = {
    name: 'bar',
    type,
    xml: `bar.${ext}-meta.xml`,
    content: `bar.${ext}`
  };
  const virtualFs = {
    dirPath: '',
    children: [`bar.${ext}`, `bar.${ext}-meta.xml`]
  };
  if (extrafile) {
    virtualFs.children.push(extrafile);
  }
  return SourceComponent.createVirtualComponent(props, [virtualFs]);
}

describe('Force Source Deploy with Sourcepath Beta', () => {
  let sandboxStub: SinonSandbox;
  let registryStub: sinon.SinonStub;
  beforeEach(() => {
    sandboxStub = createSandbox();
    registryStub = sandboxStub.stub(
      RegistryAccess.prototype,
      'getComponentsFromPath'
    );
  });

  afterEach(() => {
    sandboxStub.restore();
  });

  describe('useBetaDeployRetrieve', () => {
    it('Should return false for multiple unsupported type URI when beta configuration is enabled', () => {
      sandboxStub
        .stub(SfdxCoreSettings.prototype, 'getBetaDeployRetrieve')
        .returns(true);
      const components = [];
      components.push(createComponent(registryData.types.bot, 'js', 'car.bot'));
      components.push(
        createComponent(
          registryData.types.lightningcomponentbundle,
          'js',
          'bar.html'
        )
      );
      registryStub.returns(components);
      const uriOne = vscode.Uri.parse('file:///car.bot');
      const uriTwo = vscode.Uri.parse('file:///bar.html');
      const multipleFileProcessing = useBetaDeployRetrieve([uriOne, uriTwo]);
      expect(multipleFileProcessing).to.equal(false);
    });

    it('Should return true for multiple valid URI when beta configuration is enabled', () => {
      sandboxStub
        .stub(SfdxCoreSettings.prototype, 'getBetaDeployRetrieve')
        .returns(true);
      const components = [];
      components.push(
        createComponent(
          registryData.types.lightningcomponentbundle,
          'js',
          'car.html'
        )
      );
      components.push(
        createComponent(
          registryData.types.lightningcomponentbundle,
          'js',
          'bar.html'
        )
      );
      registryStub.returns(components);
      const uriOne = vscode.Uri.parse('file:///car.bot');
      const uriTwo = vscode.Uri.parse('file:///bar.bot');
      const multipleFileProcessing = useBetaDeployRetrieve([uriOne, uriTwo]);
      expect(multipleFileProcessing).to.equal(true);
    });

    it('Should return false for URI not part of the beta when the beta configuration is enabled', () => {
      sandboxStub
        .stub(SfdxCoreSettings.prototype, 'getBetaDeployRetrieve')
        .returns(true);
      const components = [];
      components.push(
        createComponent(
          registryData.types.lightningcomponentbundle,
          'js',
          'bar.html'
        )
      );
      registryStub.returns(components);
      const uriOne = vscode.Uri.parse('file:///bar.html');
      const fileProcessing = useBetaDeployRetrieve([uriOne]);
      expect(fileProcessing).to.equal(true);
    });

    it('Should return true for ApexClass URI when beta configuration is enabled', () => {
      sandboxStub
        .stub(SfdxCoreSettings.prototype, 'getBetaDeployRetrieve')
        .returns(true);
      const components = [];
      components.push(createComponent(registryData.types.apexclass, 'cls'));
      registryStub.returns(components);
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
      const components = [];
      components.push(createComponent(registryData.types.apexclass, 'cls'));
      registryStub.returns(components);
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
      const components = [];
      components.push(
        createComponent(registryData.types.apextrigger, 'trigger')
      );
      registryStub.returns(components);
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
      const components = [];
      components.push(
        createComponent(registryData.types.apextrigger, 'trigger')
      );
      registryStub.returns(components);
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
      const components = [];
      components.push(createComponent(registryData.types.apexpage, 'page'));
      registryStub.returns(components);
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
      const components = [];
      components.push(createComponent(registryData.types.apexpage, 'page'));
      registryStub.returns(components);
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
      const components = [];
      components.push(
        createComponent(registryData.types.apexcomponent, 'component')
      );
      registryStub.returns(components);
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
      const components = [];
      components.push(
        createComponent(registryData.types.apexcomponent, 'component')
      );
      registryStub.returns(components);
      const uriOne = vscode.Uri.parse('file:///bar.component');
      const cmpProcessing = useBetaDeployRetrieve([uriOne]);
      expect(cmpProcessing).to.equal(false);

      const uriTwo = vscode.Uri.parse('file:///bar.component-meta.xml');
      const cmpMetaProcessing = useBetaDeployRetrieve([uriTwo]);
      expect(cmpMetaProcessing).to.equal(false);
    });

    it('Should return true for LWC URI when beta configuration is enabled', () => {
      sandboxStub
        .stub(SfdxCoreSettings.prototype, 'getBetaDeployRetrieve')
        .returns(true);
      const components = [];
      components.push(
        createComponent(
          registryData.types.lightningcomponentbundle,
          'js',
          'bar.html'
        )
      );
      registryStub.returns(components);
      const uriOne = vscode.Uri.parse('file:///bar.component');
      const cmpProcessing = useBetaDeployRetrieve([uriOne]);
      expect(cmpProcessing).to.equal(true);

      const uriTwo = vscode.Uri.parse('file:///bar.component-meta.xml');
      const cmpMetaProcessing = useBetaDeployRetrieve([uriTwo]);
      expect(cmpMetaProcessing).to.equal(true);
    });

    it('Should return false for LWC URI when beta configuration is enabled', () => {
      sandboxStub
        .stub(SfdxCoreSettings.prototype, 'getBetaDeployRetrieve')
        .returns(false);
      const component = SourceComponent.createVirtualComponent(
        {
          name: 'test',
          type: registryData.types.lightningcomponentbundle,
          xml: join('lwc', 'test', 'test.js-meta.xml')
        },
        []
      );
      registryStub.returns([component]);
      const uriOne = vscode.Uri.parse('file:///bar.js');
      const cmpProcessing = useBetaDeployRetrieve([uriOne]);
      expect(cmpProcessing).to.equal(false);

      const uriTwo = vscode.Uri.parse('file:///bar.js-meta.xml');
      const cmpMetaProcessing = useBetaDeployRetrieve([uriTwo]);
      expect(cmpMetaProcessing).to.equal(false);
    });
  });

  describe('createComponentCount', () => {
    it('should correctly generate rows for telemetry', () => {
      const { name: layoutName } = registryData.types.layout;
      const { name: customAppName } = registryData.types.customapplication;
      const components = [];
      components.push(createComponent(registryData.types.layout, 'layout'));
      components.push(
        createComponent(registryData.types.customapplication, 'app')
      );
      const rows = createComponentCount(components);
      expect(rows).to.deep.equal([
        { type: layoutName, quantity: 1 },
        { type: customAppName, quantity: 1 }
      ]);
    });
  });
});
