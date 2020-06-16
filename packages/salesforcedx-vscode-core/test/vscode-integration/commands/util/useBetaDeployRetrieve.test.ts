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
import { MetadataComponent } from '@salesforce/source-deploy-retrieve/lib/types';
import { expect } from 'chai';
import * as path from 'path';
import { createSandbox, SinonSandbox, SinonStub } from 'sinon';
import { Uri } from 'vscode';
import * as vscode from 'vscode';
import { useBetaDeployRetrieve } from '../../../../src/commands/util/useBetaDeployRetrieve';
import { SfdxCoreSettings } from '../../../../src/settings/sfdxCoreSettings';

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

  it('Should return false for multiple valid URI when beta configuration is enabled', () => {
    sandboxStub
      .stub(SfdxCoreSettings.prototype, 'getBetaDeployRetrieve')
      .returns(true);
    const components: MetadataComponent[] = [
      {
        fullName: 'bar',
        type: registryData.types.apextrigger,
        xml: 'bar.trigger-meta.xml',
        sources: ['bar.trigger', 'bar.trigger-meta.xml']
      },
      {
        fullName: 'bar',
        type: registryData.types.apexclass,
        xml: 'bar.cls-meta.xml',
        sources: ['bar.cls', 'bar.cls-meta.xml']
      }
    ];
    registryStub.returns(components);
    const uriOne = vscode.Uri.parse('file:///bar.cls');
    const uriTwo = vscode.Uri.parse('file:///bar.trigger');
    const multipleFileProcessing = useBetaDeployRetrieve([uriOne, uriTwo]);
    expect(multipleFileProcessing).to.equal(false);
  });

  it('Should return false for URI not part of the beta when the beta configuration is enabled', () => {
    sandboxStub
      .stub(SfdxCoreSettings.prototype, 'getBetaDeployRetrieve')
      .returns(true);
    const components: MetadataComponent[] = [
      {
        fullName: 'bar',
        type: registryData.types.lightningcomponentbundle,
        xml: 'bar.js-meta.xml',
        sources: ['bar.js', 'bar.html', 'bar.js-meta.xml']
      }
    ];
    registryStub.returns(components);
    const uriOne = vscode.Uri.parse('file:///bar.html');
    const fileProcessing = useBetaDeployRetrieve([uriOne]);
    expect(fileProcessing).to.equal(true);
  });

  it('Should return true for ApexClass URI when beta configuration is enabled', () => {
    sandboxStub
      .stub(SfdxCoreSettings.prototype, 'getBetaDeployRetrieve')
      .returns(true);
    const components: MetadataComponent[] = [
      {
        fullName: 'bar',
        type: registryData.types.apexclass,
        xml: 'bar.cls-meta.xml',
        sources: ['bar.cls', 'bar.cls-meta.xml']
      }
    ];
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
    const components: MetadataComponent[] = [
      {
        fullName: 'bar',
        type: registryData.types.apexclass,
        xml: 'bar.cls-meta.xml',
        sources: ['bar.cls', 'bar.cls-meta.xml']
      }
    ];
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
    const components: MetadataComponent[] = [
      {
        fullName: 'bar',
        type: registryData.types.apextrigger,
        xml: 'bar.trigger-meta.xml',
        sources: ['bar.trigger', 'bar.trigger-meta.xml']
      }
    ];
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
    const components: MetadataComponent[] = [
      {
        fullName: 'bar',
        type: registryData.types.apextrigger,
        xml: 'bar.trigger-meta.xml',
        sources: ['bar.trigger', 'bar.trigger-meta.xml']
      }
    ];
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
    const components: MetadataComponent[] = [
      {
        fullName: 'bar',
        type: registryData.types.apexpage,
        xml: 'bar.page-meta.xml',
        sources: ['bar.page', 'bar.page-meta.xml']
      }
    ];
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
    const components: MetadataComponent[] = [
      {
        fullName: 'bar',
        type: registryData.types.apexpage,
        xml: 'bar.page-meta.xml',
        sources: ['bar.page', 'bar.page-meta.xml']
      }
    ];
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
    const components: MetadataComponent[] = [
      {
        fullName: 'bar',
        type: registryData.types.apexcomponent,
        xml: 'bar.component-meta.xml',
        sources: ['bar.component', 'bar.component-meta.xml']
      }
    ];
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
    const components: MetadataComponent[] = [
      {
        fullName: 'bar',
        type: registryData.types.apexcomponent,
        xml: 'bar.component-meta.xml',
        sources: ['bar.component', 'bar.component-meta.xml']
      }
    ];
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
    const components: MetadataComponent[] = [
      {
        fullName: 'bar',
        type: registryData.types.lightningcomponentbundle,
        xml: 'bar.js-meta.xml',
        sources: ['bar.js', 'bar.js-meta.xml', 'bar.html']
      }
    ];
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
    const components: MetadataComponent[] = [
      {
        fullName: 'bar',
        type: registryData.types.lightningcomponentbundle,
        xml: 'bar.js-meta.xml',
        sources: ['bar.js', 'bar.js-meta.xml', 'bar.html']
      }
    ];
    registryStub.returns(components);
    const uriOne = vscode.Uri.parse('file:///bar.component');
    const cmpProcessing = useBetaDeployRetrieve([uriOne]);
    expect(cmpProcessing).to.equal(false);

    const uriTwo = vscode.Uri.parse('file:///bar.component-meta.xml');
    const cmpMetaProcessing = useBetaDeployRetrieve([uriTwo]);
    expect(cmpMetaProcessing).to.equal(false);
  });
});

describe('Force Source Retrieve with Sourcepath Beta', () => {
  let sandboxStub: SinonSandbox;
  let mockRegistry: SinonStub;
  const apexClassMDComponent: MetadataComponent = {
    type: {
      name: 'ApexClass',
      directoryName: 'classes',
      inFolder: false,
      suffix: 'cls'
    },
    fullName: 'myTestClass',
    xml: path.join('file', 'path', 'classes', 'myTestClass.cls-meta.xml'),
    sources: [path.join('file', 'path', 'classes', 'myTestClass.cls')]
  };
  const apexTriggerMDComponent: MetadataComponent = {
    type: {
      name: 'ApexTrigger',
      directoryName: 'triggers',
      inFolder: false,
      suffix: 'trigger'
    },
    fullName: 'accTrigger',
    xml: path.join('file', 'path', 'triggers', 'accTrigger.trigger-meta.xml'),
    sources: [path.join('file', 'path', 'triggers', 'accTrigger.trigger')]
  };
  const pageMDComponent: MetadataComponent = {
    type: {
      name: 'ApexPage',
      directoryName: 'pages',
      inFolder: false,
      suffix: 'page'
    },
    fullName: 'myPage',
    xml: path.join('file', 'path', 'pages', 'myPage.page-meta.xml'),
    sources: [path.join('file', 'path', 'pages', 'myPage.page')]
  };
  const vfComponentMDComponent: MetadataComponent = {
    type: {
      name: 'ApexComponent',
      directoryName: 'components',
      inFolder: false,
      suffix: 'component'
    },
    fullName: 'myPage',
    xml: path.join('file', 'path', 'components', 'VFCmp.component-meta.xml'),
    sources: [path.join('file', 'path', 'components', 'VFCmp.component')]
  };
  const auraMDComponent: MetadataComponent = {
    type: {
      name: 'AuraDefinitionBundle',
      directoryName: 'aura',
      inFolder: false
    },
    fullName: 'testApp',
    xml: path.join('file', 'path', 'aura', 'testApp.app-meta.xml'),
    sources: [path.join('file', 'path', 'aura', 'testApp.app')]
  };
  const lwcMDComponent: MetadataComponent = {
    type: {
      name: 'LightningComponentBundle',
      directoryName: 'lwc',
      inFolder: false
    },
    fullName: 'testCmp',
    xml: path.join('file', 'path', 'lwc', 'testCmp', 'testCmp.js-meta.xml'),
    sources: [path.join('file', 'path', 'lwc', 'testCmp', 'testCmp.js')]
  };

  beforeEach(() => {
    sandboxStub = createSandbox();
    mockRegistry = sandboxStub.stub(
      RegistryAccess.prototype,
      'getComponentsFromPath'
    );
  });

  afterEach(() => {
    sandboxStub.restore();
  });

  it('Should return false for URI not part of the beta when the beta configuration is enabled', () => {
    sandboxStub
      .stub(SfdxCoreSettings.prototype, 'getBetaDeployRetrieve')
      .returns(true);
    mockRegistry.returns([
      {
        type: {
          name: 'Layout',
          directoryName: 'layouts',
          inFolder: false
        },
        fullName: 'Obj Layout',
        xml: path.join('file', 'path', 'layouts', 'Obj Layout.layout-meta.xml'),
        sources: [path.join('file', 'path', 'layouts', 'Obj Layout.layout')]
      }
    ]);
    const uriOne = Uri.parse('file:///bar.html');
    const fileProcessing = useBetaDeployRetrieve([uriOne]);
    expect(fileProcessing).to.equal(false);
  });

  it('Should return true for ApexClass URI when beta configuration is enabled', () => {
    sandboxStub
      .stub(SfdxCoreSettings.prototype, 'getBetaDeployRetrieve')
      .returns(true);
    mockRegistry.returns([apexClassMDComponent]);
    const uriOne = Uri.parse('file:///file/path/classes/myTestClass.cls');
    const apexClassProcessing = useBetaDeployRetrieve([uriOne]);
    expect(apexClassProcessing).to.equal(true);
  });

  it('Should return false for ApexClass URI when beta configuration is disabled', () => {
    sandboxStub
      .stub(SfdxCoreSettings.prototype, 'getBetaDeployRetrieve')
      .returns(false);
    mockRegistry.returns([apexClassMDComponent]);
    const uriOne = Uri.parse('file:///file/path/classes/myTestClass.cls');
    const apexClassProcessing = useBetaDeployRetrieve([uriOne]);
    expect(apexClassProcessing).to.equal(false);
  });

  it('Should return true for ApexTrigger URI when beta configuration is enabled', () => {
    sandboxStub
      .stub(SfdxCoreSettings.prototype, 'getBetaDeployRetrieve')
      .returns(true);
    mockRegistry.returns([apexTriggerMDComponent]);
    const uriOne = Uri.parse('file:///file/path/triggers/accTrigger.trigger');
    const triggerProcessing = useBetaDeployRetrieve([uriOne]);
    expect(triggerProcessing).to.equal(true);
  });

  it('Should return false for ApexTrigger URI when beta configuration is disabled', () => {
    sandboxStub
      .stub(SfdxCoreSettings.prototype, 'getBetaDeployRetrieve')
      .returns(false);
    mockRegistry.returns([apexTriggerMDComponent]);
    const uriOne = Uri.parse('file:///file/path/triggers/accTrigger.trigger');
    const triggerProcessing = useBetaDeployRetrieve([uriOne]);
    expect(triggerProcessing).to.equal(false);
  });

  it('Should return true for VF Page URI when beta configuration is enabled', () => {
    sandboxStub
      .stub(SfdxCoreSettings.prototype, 'getBetaDeployRetrieve')
      .returns(true);
    mockRegistry.returns([pageMDComponent]);
    const uriOne = Uri.parse('file:///file/path/pages/myPage.page');
    const pageProcessing = useBetaDeployRetrieve([uriOne]);
    expect(pageProcessing).to.equal(true);
  });

  it('Should return false for VF Page URI when beta configuration is disabled', () => {
    sandboxStub
      .stub(SfdxCoreSettings.prototype, 'getBetaDeployRetrieve')
      .returns(false);
    mockRegistry.returns([pageMDComponent]);
    const uriOne = Uri.parse('file:///file/path/pages/myPage.page');
    const pageProcessing = useBetaDeployRetrieve([uriOne]);
    expect(pageProcessing).to.equal(false);
  });

  it('Should return true for VF Component URI when beta configuration is enabled', () => {
    sandboxStub
      .stub(SfdxCoreSettings.prototype, 'getBetaDeployRetrieve')
      .returns(true);
    mockRegistry.returns([vfComponentMDComponent]);
    const uriOne = Uri.parse('file:///file/path/components/VFCmp.component');
    const cmpProcessing = useBetaDeployRetrieve([uriOne]);
    expect(cmpProcessing).to.equal(true);
  });

  it('Should return false for VF Component URI when beta configuration is disabled', () => {
    sandboxStub
      .stub(SfdxCoreSettings.prototype, 'getBetaDeployRetrieve')
      .returns(false);
    mockRegistry.returns([vfComponentMDComponent]);
    const uriOne = Uri.parse('file:///file/path/components/VFCmp.component');
    const cmpProcessing = useBetaDeployRetrieve([uriOne]);
    expect(cmpProcessing).to.equal(false);
  });

  it('Should return true for Aura Component URI when beta configuration is enabled', () => {
    sandboxStub
      .stub(SfdxCoreSettings.prototype, 'getBetaDeployRetrieve')
      .returns(true);
    mockRegistry.returns([auraMDComponent]);
    const uriOne = Uri.parse('file:///file/path/aura/testApp.app');
    const cmpProcessing = useBetaDeployRetrieve([uriOne]);
    expect(cmpProcessing).to.equal(true);
  });

  it('Should return false for Aura Component URI when beta configuration is disabled', () => {
    sandboxStub
      .stub(SfdxCoreSettings.prototype, 'getBetaDeployRetrieve')
      .returns(false);
    mockRegistry.returns([auraMDComponent]);
    const uriOne = Uri.parse('file:///file/path/aura/testApp.app');
    const cmpProcessing = useBetaDeployRetrieve([uriOne]);
    expect(cmpProcessing).to.equal(false);
  });

  it('Should return true for LWC Component URI when beta configuration is enabled', () => {
    sandboxStub
      .stub(SfdxCoreSettings.prototype, 'getBetaDeployRetrieve')
      .returns(true);
    mockRegistry.returns([lwcMDComponent]);
    const uriOne = Uri.parse('file:///file/path/lwc/testCmp/testCmp.js');
    const cmpProcessing = useBetaDeployRetrieve([uriOne]);
    expect(cmpProcessing).to.equal(true);
  });

  it('Should return false for LWC Component URI when beta configuration is disabled', () => {
    sandboxStub
      .stub(SfdxCoreSettings.prototype, 'getBetaDeployRetrieve')
      .returns(false);
    mockRegistry.returns([lwcMDComponent]);
    const uriOne = Uri.parse('file:///file/path/lwc/testCmp/testCmp.js');
    const cmpProcessing = useBetaDeployRetrieve([uriOne]);
    expect(cmpProcessing).to.equal(false);
  });
});
