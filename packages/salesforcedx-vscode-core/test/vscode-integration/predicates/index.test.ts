/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { SinonStub, stub } from 'sinon';
import { workspace } from 'vscode';
import { SFDX_PROJECT_FILE } from '../../../src/constants';
import { nls } from '../../../src/messages';
import { isSfdxProjectOpened } from '../../../src/predicates';
import { getRootWorkspacePath } from '../../../src/util';

// tslint:disable:no-unused-expression
describe('SFDX project predicate', () => {
  let mExistsSync: SinonStub;

  beforeEach(() => {
    mExistsSync = stub(fs, 'existsSync');
    mExistsSync.resetBehavior();
  });

  afterEach(() => mExistsSync.restore());

  it('Should fail predicate with message when sfdx-project.json is missing', () => {
    mExistsSync
      .withArgs(path.join(getRootWorkspacePath(), SFDX_PROJECT_FILE))
      .returns(false);

    const response = isSfdxProjectOpened.apply(workspace);
    expect(response.result).to.be.false;
    expect(response.message).to.eql(
      nls.localize('predicates_no_sfdx_project_found_text')
    );
  });

  it('Should pass predicate when sfdx-project.json is present', () => {
    mExistsSync
      .withArgs(path.join(getRootWorkspacePath(), SFDX_PROJECT_FILE))
      .returns(true);

    const response = isSfdxProjectOpened.apply(workspace);
    expect(response.result).to.be.true;
  });
});
