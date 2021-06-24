/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SourceComponent } from '@salesforce/source-deploy-retrieve';
import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as sinon from 'sinon';
import Sinon = require('sinon');
import { diffComponents } from '../../../src/conflict/componentDiffer';

describe('Component Differ', () => {
  let walkContentStubOne: Sinon.SinonStub;
  let walkContentStubTwo: Sinon.SinonStub;

  const dir = path.join(os.tmpdir(), 'component-diff-tests', `${new Date().getTime()}`);
  const diffPathOne = path.join(dir, 'one', 'AccountController.cls');
  const diffPathTwo = path.join(dir, 'two', 'AccountController.cls');
  const noDiffPathOne = path.join(dir, 'one', 'HandlerCostCenter.cls');
  const noDiffPathTwo = path.join(dir, 'two', 'HandlerCostCenter.cls');
  const xmlPathOne = path.join(dir, 'one', 'AccountController.cls-meta.xml');
  const xmlPathTwo = path.join(dir, 'two', 'AccountController.cls-meta.xml');
  if (!fs.existsSync(path.join(dir, 'one'))) {
    fs.mkdirSync(path.join(dir, 'one'), {recursive: true});
  }
  if (!fs.existsSync(path.join(dir, 'two'))) {
    fs.mkdirSync(path.join(dir, 'two'), {recursive: true});
  }

  const sampleComponentOne = {
    fullName: 'AccountController',
    xml: xmlPathOne,
    walkContent: () => [] as string[]
  } as SourceComponent;
  const sampleComponentTwo = {
    fullName: 'AccountController',
    xml: xmlPathTwo,
    walkContent: () => [] as string[]
  } as SourceComponent;

  fs.writeFileSync(diffPathOne, 'abc');
  fs.writeFileSync(diffPathTwo, 'def');
  fs.writeFileSync(noDiffPathOne, 'xyz');
  fs.writeFileSync(noDiffPathTwo, 'xyz');
  fs.writeFileSync(xmlPathOne, '123');
  fs.writeFileSync(xmlPathTwo, '456');

  beforeEach(() => {
    walkContentStubOne = sinon.stub(sampleComponentOne, 'walkContent');
    walkContentStubTwo = sinon.stub(sampleComponentTwo, 'walkContent');
  });

  afterEach(() => {
    walkContentStubOne.restore();
    walkContentStubTwo.restore();
  });

  it('Should return all file paths that differ', async () => {
    walkContentStubOne.returns([diffPathOne, noDiffPathOne]);
    walkContentStubTwo.returns([diffPathTwo, noDiffPathTwo]);
    const results = diffComponents(sampleComponentOne, sampleComponentTwo, path.join(dir, 'one'), path.join(dir, 'two'));

    expect(walkContentStubOne.callCount).to.equal(1);
    expect(walkContentStubTwo.callCount).to.equal(1);
    expect(results).to.have.deep.members([{
      projectPath: diffPathOne,
      cachePath: diffPathTwo
    },
    {
      projectPath: xmlPathOne,
      cachePath: xmlPathTwo
    }]);
  });
});
