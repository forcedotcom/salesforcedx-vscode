/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { expect } from 'chai';
import * as path from 'path';
import { createSandbox, SinonSandbox } from 'sinon';
import * as vscode from 'vscode';
import { AnonApexGatherer } from '../../../src/commands/forceApexExecute';
import { getRootWorkspacePath } from '../../../src/util';

// tslint:disable:no-unused-expression
describe('AnonApexGatherer', async () => {
  let sb: SinonSandbox;

  beforeEach(async () => {
    sb = createSandbox();
  });

  afterEach(async () => {
    sb.restore();
  });

  it('should return the selected file to execute anonymous apex', async () => {
    const fileName = path.join(
      getRootWorkspacePath(),
      '.sfdx',
      'tools',
      'tempApex.input'
    );
    const mockActiveTextEditor = {
      document: {
        uri: { fsPath: fileName }
      },
      selection: { isEmpty: true }
    };
    sb.stub(vscode.window, 'activeTextEditor').get(() => {
      return mockActiveTextEditor;
    });

    const fileNameGatherer = new AnonApexGatherer();
    const result = (await fileNameGatherer.gather()) as ContinueResponse<{
      fileName: string;
    }>;
    expect(result.data.fileName).to.equal(fileName);
  });

  it(`should return the currently highlighted 'selection' to execute anonymous apex`, async () => {
    const mockActiveTextEditor = {
      document: {
        getText: (doc: { isEmpty: boolean; text: string }) => doc.text
      },
      selection: { isEmpty: false, text: 'System.assert(true);' }
    };
    sb.stub(vscode.window, 'activeTextEditor').get(() => {
      return mockActiveTextEditor;
    });

    const apexCodeGatherer = new AnonApexGatherer();
    const result = (await apexCodeGatherer.gather()) as ContinueResponse<{
      apexCode: string;
    }>;
    expect(result.data.apexCode).to.equal('System.assert(true);');
  });
});
