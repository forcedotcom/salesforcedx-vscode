/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  CancelResponse,
  ContinueResponse,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { expect } from 'chai';
import { join } from 'path';
import * as sinon from 'sinon';
import { window } from 'vscode';
import {
  CommandletExecutor,
  CompositeParametersGatherer,
  DemoModePromptGatherer,
  EmptyParametersGatherer,
  SelectOutputDir,
  SfdxCommandlet,
  SimpleGatherer
} from '../../../../src/commands/util';
import { SfdxPackageDirectories } from '../../../../src/sfdxProject';
import { getRootWorkspacePath } from '../../../../src/util';

const SFDX_SIMPLE_NUM_OF_DIRS = 14;

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
        new class implements ParametersGatherer<{}> {
          public async gather(): Promise<
            CancelResponse | ContinueResponse<{}>
          > {
            return { type: 'CONTINUE', data: {} };
          }
        }(),
        new class implements ParametersGatherer<{}> {
          public async gather(): Promise<
            CancelResponse | ContinueResponse<{}>
          > {
            return { type: 'CONTINUE', data: {} };
          }
        }()
      );

      const response = await compositeParameterGatherer.gather();
      expect(response.type).to.equal('CONTINUE');
    });

    it('Should not proceed to next gatherer if previous gatherer in composite gatherer is CANCEL', async () => {
      const compositeParameterGatherer = new CompositeParametersGatherer(
        new class implements ParametersGatherer<{}> {
          public async gather(): Promise<
            CancelResponse | ContinueResponse<{}>
          > {
            return { type: 'CANCEL' };
          }
        }(),
        new class implements ParametersGatherer<{}> {
          public async gather(): Promise<
            CancelResponse | ContinueResponse<{}>
          > {
            throw new Error('This should not be called');
          }
        }()
      );

      await compositeParameterGatherer.gather();
    });

    it('Should call executor if composite gatherer is CONTINUE', async () => {
      let executed = false;
      const commandlet = new SfdxCommandlet(
        new class {
          public check(): boolean {
            return true;
          }
        }(),
        new CompositeParametersGatherer(
          new class implements ParametersGatherer<{}> {
            public async gather(): Promise<
              CancelResponse | ContinueResponse<{}>
            > {
              return { type: 'CONTINUE', data: {} };
            }
          }()
        ),
        new class implements CommandletExecutor<{}> {
          public execute(response: ContinueResponse<{}>): void {
            executed = true;
          }
        }()
      );

      await commandlet.run();

      expect(executed).to.be.true;
    });

    it('Should not call executor if composite gatherer is CANCEL', async () => {
      const commandlet = new SfdxCommandlet(
        new class {
          public check(): boolean {
            return true;
          }
        }(),
        new CompositeParametersGatherer(
          new class implements ParametersGatherer<{}> {
            public async gather(): Promise<
              CancelResponse | ContinueResponse<{}>
            > {
              return { type: 'CANCEL' };
            }
          }()
        ),
        new class implements CommandletExecutor<{}> {
          public execute(response: ContinueResponse<{}>): void {
            throw new Error('This should not be called');
          }
        }()
      );

      await commandlet.run();
    });
  });

  // Due to the way the prompt is phrased
  // CONTINUE means that we will execute the forceLogoutAll command
  // CANCEL means that we will not execute the forceLogoutAll command
  describe('DemoModePrompGatherer', () => {
    let showInformationMessageStub: sinon.SinonStub;

    before(() => {
      showInformationMessageStub = sinon.stub(window, 'showInformationMessage');
    });

    after(() => {
      showInformationMessageStub.restore();
    });

    it('Should return CONTINUE if message is Cancel', async () => {
      showInformationMessageStub.onFirstCall().returns('Cancel');
      const gatherer = new DemoModePromptGatherer();
      const result = await gatherer.gather();
      expect(result.type).to.equal('CONTINUE');
      expect((result as ContinueResponse<{}>).data!).to.eql({});
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
      const options = selector.getCustomOptions(
        packageDirs,
        getRootWorkspacePath()
      );
      expect(options.length).to.be.equal(SFDX_SIMPLE_NUM_OF_DIRS);
    });

    it('Should correctly append type folder to paths for type that requires specific parent folder', () => {
      const selector = new SelectOutputDir('aura', true);
      const options = selector.getCustomOptions(
        packageDirs,
        getRootWorkspacePath()
      );

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
      const customOptions = selector.getCustomOptions(
        packageDirs,
        getRootWorkspacePath()
      );
      const getPackageDirPathsStub = sinon.stub(
        SfdxPackageDirectories,
        'getPackageDirectoryPaths'
      );
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
});
