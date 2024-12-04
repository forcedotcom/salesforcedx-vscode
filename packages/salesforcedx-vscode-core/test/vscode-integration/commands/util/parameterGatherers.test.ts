/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { CancelResponse, ContinueResponse, ParametersGatherer } from '@salesforce/salesforcedx-utils-vscode';
import { ComponentSet, registry, SourceComponent } from '@salesforce/source-deploy-retrieve-bundle';
import { expect } from 'chai';
import * as path from 'path';
import { join } from 'path';
import * as sinon from 'sinon';
import { window } from 'vscode';
import * as vscode from 'vscode';
import {
  CommandletExecutor,
  CompositeParametersGatherer,
  DemoModePromptGatherer,
  EmptyParametersGatherer,
  FileSelection,
  FileSelector,
  SelectOutputDir,
  SfCommandlet,
  SimpleGatherer
} from '../../../../src/commands/util';
import { PromptConfirmGatherer, SelectLwcComponentDir } from '../../../../src/commands/util/parameterGatherers';
import { nls } from '../../../../src/messages';
import { SalesforcePackageDirectories } from '../../../../src/salesforceProject';
import { workspaceUtils } from '../../../../src/util';

const SFDX_SIMPLE_NUM_OF_DIRS = 16;

// tslint:disable:no-unused-expression
describe('Parameter Gatherers', () => {
  describe('EmptyParametersGatherer', () => {
    it('Should always return continue with empty object as data', async () => {
      const gatherer = new EmptyParametersGatherer();
      const response = await gatherer.gather();
      expect(response.type).to.be.eql('CONTINUE');

      const continueResponse = response as ContinueResponse<{}>;
      expect(continueResponse.data).to.be.eql({});
    });
  });

  describe('CompositeParametersGatherer', () => {
    it('Should proceed to next gatherer if previous gatherer in composite gatherer is CONTINUE', async () => {
      const compositeParameterGatherer = new CompositeParametersGatherer(
        new (class implements ParametersGatherer<{}> {
          public async gather(): Promise<CancelResponse | ContinueResponse<{}>> {
            return { type: 'CONTINUE', data: {} };
          }
        })(),
        new (class implements ParametersGatherer<{}> {
          public async gather(): Promise<CancelResponse | ContinueResponse<{}>> {
            return { type: 'CONTINUE', data: {} };
          }
        })()
      );

      const response = await compositeParameterGatherer.gather();
      expect(response.type).to.equal('CONTINUE');
    });

    it('Should not proceed to next gatherer if previous gatherer in composite gatherer is CANCEL', async () => {
      const compositeParameterGatherer = new CompositeParametersGatherer(
        new (class implements ParametersGatherer<{}> {
          public async gather(): Promise<CancelResponse | ContinueResponse<{}>> {
            return { type: 'CANCEL' };
          }
        })(),
        new (class implements ParametersGatherer<{}> {
          public async gather(): Promise<CancelResponse | ContinueResponse<{}>> {
            throw new Error('This should not be called');
          }
        })()
      );

      await compositeParameterGatherer.gather();
    });

    it('Should call executor if composite gatherer is CONTINUE', async () => {
      let executed = false;
      const commandlet = new SfCommandlet(
        new (class {
          public check(): boolean {
            return true;
          }
        })(),
        new CompositeParametersGatherer(
          new (class implements ParametersGatherer<{}> {
            public async gather(): Promise<CancelResponse | ContinueResponse<{}>> {
              return { type: 'CONTINUE', data: {} };
            }
          })()
        ),
        new (class implements CommandletExecutor<{}> {
          public execute(response: ContinueResponse<{}>): void {
            executed = true;
          }
        })()
      );

      await commandlet.run();

      expect(executed).to.be.true;
    });

    it('Should not call executor if composite gatherer is CANCEL', async () => {
      const commandlet = new SfCommandlet(
        new (class {
          public check(): boolean {
            return true;
          }
        })(),
        new CompositeParametersGatherer(
          new (class implements ParametersGatherer<{}> {
            public async gather(): Promise<CancelResponse | ContinueResponse<{}>> {
              return { type: 'CANCEL' };
            }
          })()
        ),
        new (class implements CommandletExecutor<{}> {
          public execute(response: ContinueResponse<{}>): void {
            throw new Error('This should not be called');
          }
        })()
      );

      await commandlet.run();
    });
  });

  describe('FileSelectionGatherer', () => {
    const displayMessage = 'My sample info';
    const errorMessage = 'You hit an error!';
    const gatherer = new FileSelector(displayMessage, errorMessage, 'config/**/*-scratch-def.json');
    let showQuickPickStub: sinon.SinonStub;
    let notificationStub: sinon.SinonStub;
    let fileFinderStub: sinon.SinonStub;

    beforeEach(() => {
      showQuickPickStub = sinon.stub(vscode.window, 'showQuickPick');
      notificationStub = sinon.stub(vscode.window, 'showErrorMessage');
      fileFinderStub = sinon.stub(vscode.workspace, 'findFiles');
    });

    afterEach(() => {
      showQuickPickStub.restore();
      notificationStub.restore();
      fileFinderStub.restore();
    });

    it('Should return continue if file has been selected', async () => {
      fileFinderStub.returns([vscode.Uri.file('/somepath/project-scratch-def.json')]);
      showQuickPickStub.returns({
        label: 'project-scratch-def.json',
        description: '/somepath/project-scratch-def.json'
      });

      const response = (await gatherer.gather()) as ContinueResponse<FileSelection>;

      expect(showQuickPickStub.callCount).to.equal(1);
      expect(response.type).to.equal('CONTINUE');
      expect(response.data.file, 'project-scratch-def.json');
    });

    it('Should return cancel if no file was selected', async () => {
      fileFinderStub.returns([vscode.Uri.file('/somepath/project-scratch-def.json')]);
      showQuickPickStub.returns(undefined);

      const response = await gatherer.gather();

      expect(showQuickPickStub.callCount).to.equal(1);
      expect(response.type).to.equal('CANCEL');
    });

    it('Should display error when no files are available for selection', async () => {
      fileFinderStub.returns([]);

      const response = await gatherer.gather();

      expect(response.type).to.equal('CANCEL');
      expect(notificationStub.calledOnce).to.be.true;
      expect(notificationStub.getCall(0).args[0]).to.equal(errorMessage);
    });
  });

  // Due to the way the prompt is phrased
  // CONTINUE means that we will execute the forceLogoutAll command
  // CANCEL means that we will not execute the forceLogoutAll command
  describe('DemoModePrompGatherer', () => {
    let showInformationMessageStub: sinon.SinonStub;

    beforeEach(() => {
      showInformationMessageStub = sinon.stub(window, 'showInformationMessage');
    });

    afterEach(() => {
      showInformationMessageStub.restore();
    });

    it('Should return CONTINUE if message is Cancel', async () => {
      showInformationMessageStub.onFirstCall().returns('Cancel');
      const gatherer = new DemoModePromptGatherer();
      const result = await gatherer.gather();
      expect(result.type).to.equal('CONTINUE');
      expect((result as ContinueResponse<{}>).data).to.eql({});
    });

    it('Should return CANCEL if message is Authorize Org', async () => {
      showInformationMessageStub.onFirstCall().returns('Cancel');
      const gatherer = new DemoModePromptGatherer();
      const result = await gatherer.gather();
      expect(result.type).to.equal('CANCEL');
    });
  });

  describe('SelectOutputDir', () => {
    const packageDirs = ['force-app'];

    it('Should correctly build default menu options', async () => {
      const selector = new SelectOutputDir('test');
      const options = selector.getDefaultOptions(['testapp', 'testapp2']);

      expect(options).to.eql([
        join('testapp', SelectOutputDir.defaultOutput, 'test'),
        join('testapp2', SelectOutputDir.defaultOutput, 'test'),
        SelectOutputDir.customDirOption
      ]);
    });

    it('Should generate correct number of custom options for a workspace', async () => {
      const selector = new SelectOutputDir('test');
      const options = selector.getCustomOptions(packageDirs, workspaceUtils.getRootWorkspacePath());
      expect(options.length).to.be.equal(SFDX_SIMPLE_NUM_OF_DIRS);
    });

    it('Should correctly append type folder to paths for type that requires specific parent folder', () => {
      const selector = new SelectOutputDir('aura', true);
      const options = selector.getCustomOptions(packageDirs, workspaceUtils.getRootWorkspacePath());

      expect(
        options.every(outputDir => {
          // don't append the type name if the output dir already has that as its name
          return outputDir.endsWith('aura') && !outputDir.endsWith('aura/aura');
        })
      ).to.be.true;
    });

    it('Should gather paths from correct sources and prompt custom dir if chosen', async () => {
      const selector = new SelectOutputDir('test');
      const defaultOptions = selector.getDefaultOptions(packageDirs);
      const customOptions = selector.getCustomOptions(packageDirs, workspaceUtils.getRootWorkspacePath());
      const getPackageDirPathsStub = sinon.stub(SalesforcePackageDirectories, 'getPackageDirectoryPaths');
      const showMenuStub = sinon.stub(selector, 'showMenu');
      const choice = customOptions[5];
      getPackageDirPathsStub.returns(packageDirs);
      showMenuStub.onFirstCall().returns(SelectOutputDir.customDirOption);
      showMenuStub.onSecondCall().returns(choice);

      const response = await selector.gather();

      try {
        expect(showMenuStub.getCall(0).calledWith(defaultOptions)).to.be.true;
        expect(showMenuStub.getCall(1).calledWith(customOptions)).to.be.true;
        expect(response).to.eql({
          type: 'CONTINUE',
          data: { outputdir: choice }
        });
      } finally {
        getPackageDirPathsStub.restore();
        showMenuStub.restore();
      }
    });
  });
  describe('SelectLwcComponentDir', async () => {
    it('Should gather filepath and Lightning web component options', async () => {
      const selector = new SelectLwcComponentDir();
      const packageDirs = ['force-app'];
      const filePath = path.join('force-app', 'main', 'default', 'lwc', 'test');
      const component = SourceComponent.createVirtualComponent(
        {
          name: 'test',
          type: registry.types.lightningcomponentbundle,
          xml: path.join(filePath, 'test.js-meta.xml')
        },
        []
      );
      const mockComponents = new ComponentSet([component]);
      const getPackageDirPathsStub = sinon.stub(SalesforcePackageDirectories, 'getPackageDirectoryPaths');
      const getLwcsStub = sinon.stub(ComponentSet, 'fromSource');
      getLwcsStub.withArgs(path.join(workspaceUtils.getRootWorkspacePath(), packageDirs[0])).returns(mockComponents);
      const showMenuStub = sinon.stub(selector, 'showMenu');
      getPackageDirPathsStub.returns(packageDirs);
      const dirChoice = packageDirs[0];
      const componentChoice = component.fullName;
      showMenuStub.onFirstCall().returns(dirChoice);
      showMenuStub.onSecondCall().returns(componentChoice);

      const response = await selector.gather();
      try {
        expect(showMenuStub.getCall(0).calledWith(packageDirs)).to.be.true;
        expect(response).to.eql({
          type: 'CONTINUE',
          data: { outputdir: filePath, fileName: componentChoice }
        });
      } finally {
        getPackageDirPathsStub.restore();
        showMenuStub.restore();
        getLwcsStub.restore();
      }
    });

    it('Should gracefully cancel if LWC is not selected', async () => {
      const selector = new SelectLwcComponentDir();
      const packageDirs = ['force-app'];
      const filePath = path.join('force-app', 'main', 'default', 'lwc', 'test');
      const component = SourceComponent.createVirtualComponent(
        {
          name: 'test',
          type: registry.types.lightningcomponentbundle,
          xml: path.join(filePath, 'test.js-meta.xml')
        },
        []
      );
      const mockComponents = new ComponentSet([component]);
      const getPackageDirPathsStub = sinon.stub(SalesforcePackageDirectories, 'getPackageDirectoryPaths');
      const getLwcsStub = sinon.stub(ComponentSet, 'fromSource');
      getLwcsStub.withArgs(path.join(workspaceUtils.getRootWorkspacePath(), packageDirs[0])).returns(mockComponents);
      const showMenuStub = sinon.stub(selector, 'showMenu');
      getPackageDirPathsStub.returns(packageDirs);
      const dirChoice = packageDirs[0];
      showMenuStub.onFirstCall().returns(dirChoice);
      showMenuStub.onSecondCall().returns('');

      const response = await selector.gather();
      try {
        expect(response).to.eql({
          type: 'CANCEL'
        });
      } finally {
        getPackageDirPathsStub.restore();
        showMenuStub.restore();
        getLwcsStub.restore();
      }
    });
  });

  describe('SimpleGatherer', () => {
    it('Should gather input that was given into a ContinueResponse', async () => {
      const input = { a: 'a', b: true, c: 2 };
      const response = await new SimpleGatherer(input).gather();
      expect(response).to.eql({
        type: 'CONTINUE',
        data: input
      });
    });
  });

  describe('PromptConfirmGatherer', () => {
    it('Should return CONTINUE if confirmation to proceed is positive', async () => {
      const promptConfirm = new PromptConfirmGatherer('question');
      const showMenuStub = sinon.stub(promptConfirm, 'showMenu');
      const choice = nls.localize('parameter_gatherer_prompt_confirm_option');
      showMenuStub.onFirstCall().returns(choice);
      const response = await promptConfirm.gather();
      expect(response).to.eql({
        type: 'CONTINUE',
        data: {
          choice
        }
      });
    });

    it('Should return CANCEL if confirmation to proceed is negative', async () => {
      const promptConfirm = new PromptConfirmGatherer('question');
      const showMenuStub = sinon.stub(promptConfirm, 'showMenu');
      const choice = nls.localize('parameter_gatherer_prompt_cancel_option');
      showMenuStub.onFirstCall().returns(choice);
      const response = await promptConfirm.gather();
      expect(response).to.eql({
        type: 'CANCEL'
      });
    });
  });
});
