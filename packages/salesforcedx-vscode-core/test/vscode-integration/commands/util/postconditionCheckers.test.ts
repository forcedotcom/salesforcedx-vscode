/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { LocalComponent } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { expect } from 'chai';
import * as fs from 'fs';
import { join } from 'path';
import { sandbox, SinonStub } from 'sinon';
import {
  FilePathExistsChecker,
  PathStrategyFactory
} from '../../../../src/commands/util';
import { nls } from '../../../../src/messages';
import { notificationService } from '../../../../src/notifications';
import { getRootWorkspacePath } from '../../../../src/util';
import { MetadataDictionary } from '../../../../src/util/metadataDictionary';
import { format } from 'util';

const env = sandbox.create();

describe('Postcondition Checkers', () => {
  describe('FilePathExistsChecker', () => {
    let existsStub: SinonStub;
    let modalStub: SinonStub;
    let promptStub: SinonStub;
    const checker = new FilePathExistsChecker();

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

      const pathExists = (
        value: boolean,
        forComponent: LocalComponent,
        withExtension: string
      ) => {
        const path = join(
          getRootWorkspacePath(),
          `package/tests/${forComponent.fileName}${withExtension}`
        );
        existsStub.withArgs(path).returns(value);
      };
    });

    describe('Overwrite Dialog Message', () => {
      it('Should show every action when there are multiple components to overwrite', () => {
        checker.promptOverwrite(generateComponents(2));

        expect(modalStub.firstCall.args.slice(1)).to.eql([
          nls.localize('warning_prompt_overwrite'),
          nls.localize('warning_prompt_skip'),
          `${nls.localize('warning_prompt_overwrite_all')} (2)`,
          `${nls.localize('warning_prompt_skip_all')} (2)`
        ]);
      });

      it('Should only show overwrite and cancel for one component', () => {
        checker.promptOverwrite(generateComponents(1));

        expect(modalStub.firstCall.args.slice(1)).to.eql([
          nls.localize('warning_prompt_overwrite')
        ]);
      });

      it('Should show correct message for one component', () => {
        const components = generateComponents(1);
        checker.promptOverwrite(components);

        const { fileName, type } = components[0];
        expect(modalStub.firstCall.args[0]).to.equal(
          nls.localize(
            'warning_prompt_overwrite_message',
            type,
            fileName,
            '',
            ''
          )
        );
      });

      it('Should show correct message for 1 < components <= 10 ', () => {
        const components = generateComponents(5);
        let expectedBody = '';
        for (const component of components.slice(1)) {
          expectedBody += `${component.type}:${component.fileName}\n`;
        }

        checker.promptOverwrite(components);

        const { fileName, type } = components[0];
        expect(modalStub.firstCall.args[0]).to.equal(
          nls.localize(
            'warning_prompt_overwrite_message',
            type,
            fileName,
            nls.localize('warning_prompt_other_existing', 4),
            expectedBody
          )
        );
      });

      it('Should show correct message for components > 10', () => {});
    });

    describe('Overwrite Dialog Actions', () => {
      it('Should skip all', () => {});

      it('Should overwrite all', () => {});

      it('Should skip one and overwrite remaining', () => {});

      it('Should overwrite one and skip remaining', () => {});

      it('Should cancel', () => {});
    });

    const generateComponents = (count: number) => {
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
    };

    // type OneOrMany = LocalComponent | LocalComponent[];
    // async function createResponse(data: OneOrMany): Promise<OneOrMany> {
    //   const checker = new FilePathExistsChecker();
    //   return (await checker.check({
    //     type: 'CONTINUE',
    //     data
    //   });
    // }
    // let findFilesStub: SinonStub;
    // let checker: FilePathExistsChecker;
    // let warningStub: SinonStub;
    // const testUri = Uri.file('/test/path');
    // const testInput: ContinueResponse<DirFileNameSelection> = {
    //   type: 'CONTINUE',
    //   data: { outputdir: 'test', fileName: 'test' }
    // };

    // beforeEach(() => {
    //   findFilesStub = env.stub(workspace, 'findFiles');
    //   warningStub = env.stub(notificationService, 'showWarningMessage');
    //   checker = new FilePathExistsChecker(
    //     new TestGlobStrategy(),
    //     'testMessage'
    //   );
    // });

    // it('Should find files based on glob strategy', async () => {
    //   findFilesStub.returns([]);
    //   await checker.check(testInput);
    //   expect(findFilesStub.firstCall.args).to.eql(TestGlobStrategy.testGlobs);
    // });

    // it('Should prompt overwrite message with correct message', async () => {
    //   findFilesStub.returns([testUri]);
    //   warningStub.returns(nls.localize('warning_prompt_overwrite_cancel'));
    //   await checker.check(testInput);
    //   expect(warningStub.firstCall.args[0]).to.equal('testMessage');
    // });

    // it('Should return ContinueResponse if there are no existing files', async () => {
    //   findFilesStub.returns([]);
    //   const response = await checker.check(testInput);
    //   expect(response.type).to.equal('CONTINUE');
    // });

    // it('Should prompt overwrite message and return ContinueResponse if accepted', async () => {
    //   findFilesStub.returns([testUri]);
    //   warningStub.returns(nls.localize('warning_prompt_continue_confirm'));
    //   const response = await checker.check(testInput);
    //   expect(warningStub.calledOnce).to.equal(true);
    //   expect(response.type).to.equal('CONTINUE');
    // });

    // it('Should prompt overwrite message and return CancelResponse if cancelled', async () => {
    //   findFilesStub.returns([testUri]);
    //   warningStub.returns(nls.localize('warning_prompt_overwrite_cancel'));
    //   const response = await checker.check(testInput);
    //   expect(warningStub.calledOnce).to.equal(true);
    //   expect(response.type).to.equal('CANCEL');
    // });
  });
});

// class TestGlobStrategy implements GlobStrategy {
//   public static readonly testGlobs = ['{/test,/glob}'];
//   public async globs() {
//     return TestGlobStrategy.testGlobs;
//   }
// }
