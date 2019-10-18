/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ContinueResponse,
  DirFileNameSelection,
  LocalComponent
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { expect } from 'chai';
import * as fs from 'fs';
import { join } from 'path';
import { sandbox, SinonStub } from 'sinon';
import { Uri, workspace } from 'vscode';
import {
  EmptyPostChecker,
  GlobStrategy,
  OverwriteComponentPrompt,
  PathStrategyFactory
} from '../../../../src/commands/util';
import { nls } from '../../../../src/messages';
import { notificationService } from '../../../../src/notifications';
import { getRootWorkspacePath } from '../../../../src/util';
import { MetadataDictionary } from '../../../../src/util/metadataDictionary';

const env = sandbox.create();

describe('Postcondition Checkers', () => {
  describe('EmptyPostconditionChecker', () => {
    it('Should return CancelResponse if input passed in is CancelResponse', async () => {
      const postChecker = new EmptyPostChecker();
      const response = await postChecker.check({ type: 'CANCEL' });
      expect(response.type).to.equal('CANCEL');
    });

    it('Should return ContinueResponse unchanged if input passed in is ContinueResponse', async () => {
      const postChecker = new EmptyPostChecker();
      const input: ContinueResponse<string> = {
        type: 'CONTINUE',
        data: 'test'
      };
      const response = await postChecker.check(input);
      expect(response.type).to.equal('CONTINUE');
      if (response.type === 'CONTINUE') {
        expect(response.data).to.equal('test');
      } else {
        expect.fail('Response should be of type ContinueResponse');
      }
    });
  });

  describe('OverwriteComponentPrompt', () => {
    let existsStub: SinonStub;
    let modalStub: SinonStub;
    let promptStub: SinonStub;
    const checker = new OverwriteComponentPrompt();

    beforeEach(() => {
      existsStub = env.stub(fs, 'existsSync');
      modalStub = env.stub(notificationService, 'showWarningModal');
    });

    afterEach(() => env.restore());

    describe('Check Components Exist', () => {
      beforeEach(() => (promptStub = env.stub(checker, 'promptOverwrite')));

      it('Should not prompt overwrite if components do not exist', async () => {
        existsStub.returns(true);
        const data = generateComponents(2);
        pathExists(false, data[0], '.t-meta.xml');
        pathExists(false, data[1], '.t-meta.xml');

        await checker.check({ type: 'CONTINUE', data });

        expect(promptStub.notCalled).to.equal(true);
      });

      it('Should prompt overwrite for components that exist', async () => {
        existsStub.returns(false);
        const data = generateComponents(2);
        pathExists(true, data[0], '.t-meta.xml');

        await checker.check({ type: 'CONTINUE', data });

        expect(promptStub.firstCall.args[0]).to.eql([data[0]]);
      });

      it('Should determine a component exists if at least one of its file extensions do', async () => {
        const dictionaryStub = env.stub(MetadataDictionary, 'getInfo');
        dictionaryStub.returns({
          pathStrategy: PathStrategyFactory.createDefaultStrategy(),
          extensions: ['.a', '.b', '.c']
        });
        existsStub.returns(false);
        const data = generateComponents(1);
        pathExists(true, data[0], '.c');

        await checker.check({ type: 'CONTINUE', data });

        expect(existsStub.firstCall.returnValue).to.equal(false);
        expect(existsStub.secondCall.returnValue).to.equal(false);
        expect(promptStub.firstCall.args[0]).to.eql([data[0]]);
      });
    });

    describe('Overwrite Dialog Message', () => {
      it('Should show every action when there are multiple components to overwrite', async () => {
        await checker.promptOverwrite(generateComponents(2));

        expect(modalStub.firstCall.args.slice(1)).to.eql([
          nls.localize('warning_prompt_overwrite'),
          nls.localize('warning_prompt_skip'),
          nls.localize('warning_prompt_overwrite_all') + ' (2)',
          nls.localize('warning_prompt_skip_all') + ' (2)'
        ]);
      });

      it('Should only show overwrite and cancel for one component', async () => {
        await doPrompt(generateComponents(1), [undefined]);

        expect(modalStub.firstCall.args.slice(1)).to.eql([
          nls.localize('warning_prompt_overwrite')
        ]);
      });

      it('Should show correct message for one component', async () => {
        const components = generateComponents(1);

        await doPrompt(components, [undefined]);

        expect(modalStub.firstCall.args[0]).to.equal(
          nls.localize(
            'warning_prompt_overwrite_message',
            components[0].type,
            components[0].fileName,
            '',
            ''
          )
        );
      });

      it('Should show correct message for 1 < components <= 10 ', async () => {
        const components = generateComponents(2);
        const expectedBody = `${components[1].type}:${
          components[1].fileName
        }\n`;

        await doPrompt(components, [undefined]);

        expect(modalStub.firstCall.args[0]).to.equal(
          nls.localize(
            'warning_prompt_overwrite_message',
            components[0].type,
            components[0].fileName,
            nls.localize('warning_prompt_other_existing', 1),
            expectedBody
          )
        );
      });

      it('Should show correct message for components > 10', async () => {
        const components = generateComponents(12);
        let expectedBody = '';
        for (const component of components.slice(1, 11)) {
          expectedBody += `${component.type}:${component.fileName}\n`;
        }
        expectedBody += `${nls.localize('warning_prompt_other_not_shown', 1)}`;

        await doPrompt(components, [undefined]);

        expect(modalStub.firstCall.args[0]).to.equal(
          nls.localize(
            'warning_prompt_overwrite_message',
            components[0].type,
            components[0].fileName,
            nls.localize('warning_prompt_other_existing', 11),
            expectedBody
          )
        );
      });
    });

    describe('Overwrite Dialog Actions', () => {
      it('Should skip all', async () => {
        const components = generateComponents(2);
        const actions = [`${nls.localize('warning_prompt_skip_all')} (2)`];

        const response = await doPrompt(components, actions);

        expect(response.type).to.equal('CANCEL');
      });

      it('Should overwrite all', async () => {
        const components = generateComponents(2);
        const actions = [`${nls.localize('warning_prompt_overwrite_all')} (2)`];

        const response = (await doPrompt(
          components,
          actions
        )) as ContinueResponse<LocalComponent[] | LocalComponent>;

        expect(response.data).to.eql(components);
      });

      it('Should skip one and overwrite remaining', async () => {
        const components = generateComponents(3);
        const actions = [
          nls.localize('warning_prompt_skip'),
          nls.localize('warning_prompt_overwrite_all') + ' (2)'
        ];

        const response = (await doPrompt(
          components,
          actions
        )) as ContinueResponse<LocalComponent[] | LocalComponent>;

        expect(response.data).to.eql(components.slice(1));
      });

      it('Should overwrite one and skip remaining', async () => {
        const components = generateComponents(3);
        const actions = [
          nls.localize('warning_prompt_overwrite'),
          nls.localize('warning_prompt_skip_all') + ' (2)'
        ];

        const response = (await doPrompt(
          components,
          actions
        )) as ContinueResponse<LocalComponent[] | LocalComponent>;

        expect(response.data).to.eql(components.slice(0, 1));
      });

      it('Should cancel', async () => {
        const components = generateComponents(3);
        const actions = [undefined];

        const response = await doPrompt(components, actions);

        expect(response.type).to.equal('CANCEL');
      });
    });

    async function doPrompt(components: LocalComponent[], actions: any[]) {
      components.forEach((component, index) => {
        pathExists(true, component, '.t-meta.xml');
        if (index < actions.length) {
          modalStub.onCall(index).returns(actions[index]);
        }
      });

      return await checker.check({
        type: 'CONTINUE',
        data: components
      });
    }

    function generateComponents(count: number) {
      const data = [];
      for (let i = 1; i <= count; i++) {
        data.push({
          fileName: `Test${i}`,
          outputdir: 'package/tests',
          type: 'TestType',
          suffix: 't'
        });
      }
      return data;
    }

    function pathExists(
      value: boolean,
      forComponent: LocalComponent,
      withExtension: string
    ) {
      const path = join(
        getRootWorkspacePath(),
        `package/tests/${forComponent.fileName}${withExtension}`
      );
      existsStub.withArgs(path).returns(value);
    }
  });
});

class TestGlobStrategy implements GlobStrategy {
  public static readonly testGlobs = ['{/test,/glob}'];
  public async globs() {
    return TestGlobStrategy.testGlobs;
  }
}
