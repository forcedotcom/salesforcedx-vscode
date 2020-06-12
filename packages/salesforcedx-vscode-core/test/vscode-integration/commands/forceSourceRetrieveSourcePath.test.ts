/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CancelResponse,
  ContinueResponse
} from '@salesforce/salesforcedx-utils-vscode/out/src/types/index';
import { RegistryAccess } from '@salesforce/source-deploy-retrieve';
import { MetadataComponent } from '@salesforce/source-deploy-retrieve/lib/types';
import { expect } from 'chai';
import * as path from 'path';
import { createSandbox, SinonSandbox, SinonStub } from 'sinon';
import { Uri } from 'vscode';
import { channelService } from '../../../src/channels';
import {
  ForceSourceRetrieveSourcePathExecutor,
  SourcePathChecker
} from '../../../src/commands/forceSourceRetrieveSourcePath';
import { useBetaDeployRetrieve } from '../../../src/commands/util/useBetaDeployRetrieve';
import { nls } from '../../../src/messages';
import { notificationService } from '../../../src/notifications';
import { SfdxCoreSettings } from '../../../src/settings/sfdxCoreSettings';
import { SfdxPackageDirectories } from '../../../src/sfdxProject';
import { getRootWorkspacePath } from '../../../src/util';

describe('Force Source Retrieve with Sourcepath Option', () => {
  it('Should build the source retrieve command', () => {
    const sourcePath = path.join('path', 'to', 'sourceFile');
    const sourceRetrieve = new ForceSourceRetrieveSourcePathExecutor();
    const sourceRetrieveCommand = sourceRetrieve.build(sourcePath);
    expect(sourceRetrieveCommand.toCommand()).to.equal(
      `sfdx force:source:retrieve --sourcepath ${sourcePath}`
    );
    expect(sourceRetrieveCommand.description).to.equal(
      nls.localize('force_source_retrieve_text')
    );
  });
});

describe('SourcePathChecker', () => {
  let workspacePath: string;
  let sandboxStub: SinonSandbox;
  let appendLineSpy: SinonStub;
  let showErrorMessageSpy: SinonStub;
  beforeEach(() => {
    sandboxStub = createSandbox();
    workspacePath = getRootWorkspacePath();
    appendLineSpy = sandboxStub.stub(channelService, 'appendLine');
    showErrorMessageSpy = sandboxStub.stub(
      notificationService,
      'showErrorMessage'
    );
  });

  afterEach(() => {
    sandboxStub.restore();
  });

  it('Should continue when source path is in a package directory', async () => {
    const isInPackageDirectoryStub = sandboxStub
      .stub(SfdxPackageDirectories, 'isInPackageDirectory')
      .returns(true);
    const pathChecker = new SourcePathChecker();
    const sourcePath = path.join(workspacePath, 'package');
    const continueResponse = (await pathChecker.check({
      type: 'CONTINUE',
      data: sourcePath
    })) as ContinueResponse<string>;

    expect(isInPackageDirectoryStub.getCall(0).args[0]).to.equal(sourcePath);
    expect(continueResponse.type).to.equal('CONTINUE');
    expect(continueResponse.data).to.equal(sourcePath);

    isInPackageDirectoryStub.restore();
  });

  it('Should notify user and cancel when source path is not inside of a package directory', async () => {
    const isInPackageDirectoryStub = sandboxStub
      .stub(SfdxPackageDirectories, 'isInPackageDirectory')
      .returns(false);
    const pathChecker = new SourcePathChecker();
    const cancelResponse = (await pathChecker.check({
      type: 'CONTINUE',
      data: path.join('not', 'in', 'package', 'directory')
    })) as CancelResponse;

    const errorMessage = nls.localize(
      'error_source_path_not_in_package_directory_text'
    );
    expect(appendLineSpy.getCall(0).args[0]).to.equal(errorMessage);
    expect(showErrorMessageSpy.getCall(0).args[0]).to.equal(errorMessage);
    expect(cancelResponse.type).to.equal('CANCEL');
    isInPackageDirectoryStub.restore();
  });

  it('Should cancel and notify user if an error occurs when fetching the package directories', async () => {
    const isInPackageDirectoryStub = sandboxStub
      .stub(SfdxPackageDirectories, 'isInPackageDirectory')
      .throws(new Error());
    const pathChecker = new SourcePathChecker();
    const cancelResponse = (await pathChecker.check({
      type: 'CONTINUE',
      data: 'test/path'
    })) as CancelResponse;

    const errorMessage = nls.localize(
      'error_source_path_not_in_package_directory_text'
    );
    expect(appendLineSpy.getCall(0).args[0]).to.equal(errorMessage);
    expect(showErrorMessageSpy.getCall(0).args[0]).to.equal(errorMessage);
    expect(cancelResponse.type).to.equal('CANCEL');
    isInPackageDirectoryStub.restore();
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
