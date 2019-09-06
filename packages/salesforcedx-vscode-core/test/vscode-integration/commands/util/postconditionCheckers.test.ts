/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ContinueResponse,
  DirFileNameSelection
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { expect } from 'chai';
import { sandbox, SinonStub } from 'sinon';
import { Uri, workspace } from 'vscode';
import { FilePathExistsChecker } from '../../../../src/commands/util';
import { GlobStrategy } from '../../../../src/commands/util';
import { nls } from '../../../../src/messages';
import { notificationService } from '../../../../src/notifications';

const env = sandbox.create();

describe('Postcondition Checkers', () => {
  describe('FilePathExistsChecker', () => {
    let findFilesStub: SinonStub;
    let checker: FilePathExistsChecker;
    let warningStub: SinonStub;
    const testUri = Uri.file('/test/path');
    const testInput: ContinueResponse<DirFileNameSelection> = {
      type: 'CONTINUE',
      data: { outputdir: 'test', fileName: 'test' }
    };

    beforeEach(() => {
      findFilesStub = env.stub(workspace, 'findFiles');
      warningStub = env.stub(notificationService, 'showWarningMessage');
      checker = new FilePathExistsChecker(
        new TestGlobStrategy(),
        'testMessage'
      );
    });

    afterEach(() => env.restore());

    it('Should find files based on glob strategy', async () => {
      findFilesStub.returns([]);
      await checker.check(testInput);
      expect(findFilesStub.firstCall.args).to.eql(TestGlobStrategy.testGlobs);
    });

    it('Should prompt overwrite message with correct message', async () => {
      findFilesStub.returns([testUri]);
      warningStub.returns(nls.localize('warning_prompt_overwrite_cancel'));
      await checker.check(testInput);
      expect(warningStub.firstCall.args[0]).to.equal('testMessage');
    });

    it('Should return ContinueResponse if there are no existing files', async () => {
      findFilesStub.returns([]);
      const response = await checker.check(testInput);
      expect(response.type).to.equal('CONTINUE');
    });

    it('Should prompt overwrite message and return ContinueResponse if accepted', async () => {
      findFilesStub.returns([testUri]);
      warningStub.returns(nls.localize('warning_prompt_continue_confirm'));
      const response = await checker.check(testInput);
      expect(warningStub.calledOnce).to.equal(true);
      expect(response.type).to.equal('CONTINUE');
    });

    it('Should prompt overwrite message and return CancelResponse if cancelled', async () => {
      findFilesStub.returns([testUri]);
      warningStub.returns(nls.localize('warning_prompt_overwrite_cancel'));
      const response = await checker.check(testInput);
      expect(warningStub.calledOnce).to.equal(true);
      expect(response.type).to.equal('CANCEL');
    });
  });
});

class TestGlobStrategy implements GlobStrategy {
  public static readonly testGlobs = ['{/test,/glob}'];
  public async globs() {
    return TestGlobStrategy.testGlobs;
  }
}
