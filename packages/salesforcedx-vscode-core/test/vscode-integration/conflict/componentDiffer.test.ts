/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SourceComponent } from '@salesforce/source-deploy-retrieve-bundle';
import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as sinon from 'sinon';
import * as Sinon from 'sinon';
import { diffComponents } from '../../../src/conflict/componentDiffer';

describe('Component Differ', () => {
  let walkContentStubOne: Sinon.SinonStub;
  let walkContentStubTwo: Sinon.SinonStub;

  const dir = path.join(os.tmpdir(), 'component-diff-tests', `${new Date().getTime()}`);
  const diffPathLocal = path.join(dir, 'local', 'dirOne', 'AccountController.cls');
  const diffPathRemote = path.join(dir, 'remote', 'AccountController.cls');
  const noDiffPathLocal = path.join(dir, 'local', 'dirTwo', 'HandlerCostCenter.cls');
  const noDiffPathRemote = path.join(dir, 'remote', 'HandlerCostCenter.cls');
  const xmlPathLocal = path.join(dir, 'local', 'dirOne', 'AccountController.cls-meta.xml');
  const xmlPathRemote = path.join(dir, 'remote', 'AccountController.cls-meta.xml');
  if (!fs.existsSync(path.join(dir, 'local'))) {
    fs.mkdirSync(path.join(dir, 'local', 'dirOne'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'local', 'dirTwo'));
  }
  if (!fs.existsSync(path.join(dir, 'remote'))) {
    fs.mkdirSync(path.join(dir, 'remote'), { recursive: true });
  }

  const sampleComponentOne = {
    fullName: 'AccountController',
    xml: xmlPathLocal,
    walkContent: () => [] as string[]
  } as SourceComponent;
  const sampleComponentTwo = {
    fullName: 'AccountController',
    xml: xmlPathRemote,
    walkContent: () => [] as string[]
  } as SourceComponent;

  fs.writeFileSync(diffPathLocal, 'abc');
  fs.writeFileSync(diffPathRemote, 'def');
  fs.writeFileSync(noDiffPathLocal, 'xyz');
  fs.writeFileSync(noDiffPathRemote, 'xyz');
  fs.writeFileSync(xmlPathLocal, '123');
  fs.writeFileSync(xmlPathRemote, '456');

  beforeEach(() => {
    walkContentStubOne = sinon.stub(sampleComponentOne, 'walkContent');
    walkContentStubTwo = sinon.stub(sampleComponentTwo, 'walkContent');
  });

  afterEach(() => {
    walkContentStubOne.restore();
    walkContentStubTwo.restore();
  });

  it('Should return all file paths that differ', async () => {
    walkContentStubOne.returns([diffPathLocal, noDiffPathLocal]);
    walkContentStubTwo.returns([diffPathRemote, noDiffPathRemote]);
    const results = diffComponents(sampleComponentOne, sampleComponentTwo);

    expect(walkContentStubOne.callCount).to.equal(1);
    expect(walkContentStubTwo.callCount).to.equal(1);
    expect(results).to.have.deep.members([
      {
        projectPath: diffPathLocal,
        cachePath: diffPathRemote
      },
      {
        projectPath: xmlPathLocal,
        cachePath: xmlPathRemote
      }
    ]);
  });
});
