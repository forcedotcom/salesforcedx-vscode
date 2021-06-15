/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { FileProperties, SourceComponent } from '@salesforce/source-deploy-retrieve';
import { fail, file } from 'assert';
import { expect } from 'chai';
import * as path from 'path';
import { sample } from 'rxjs/operator/sample';
import * as shell from 'shelljs';
import * as sinon from 'sinon';
import Sinon = require('sinon');
import {
  PersistentStorageService
} from '../../../src/conflict';
import { ComponentDiff, ComponentDiffer } from '../../../src/conflict/componentDiffer';
import {
  MetadataCacheResult
} from '../../../src/conflict/metadataCacheService';
import { TimestampConflictDetector } from '../../../src/conflict/timestampConflictDetector';
import { nls } from '../../../src/messages';
import { stubRootWorkspace } from '../util/rootWorkspace.test-util';

describe('Component Differ', () => {
  const differ = new ComponentDiffer();
  let walkContetStub: Sinon.SinonStub;
  let filesDifferStub: Sinon.SinonStub;

  const sampleComponent = {
    fullName: 'AccountController',
    xml: 'AccountController.cls-meta.xml',
    walkContent: () => [] as string[]
  } as SourceComponent;

  beforeEach(() => {
    walkContetStub = sinon.stub(sampleComponent, 'walkContent');
    filesDifferStub = sinon.stub(differ, 'filesDiffer');
  });

  afterEach(() => {
    walkContetStub.restore();
    filesDifferStub.restore();
  });

  it('Should return all file paths that differ', () => {
    walkContetStub.returns([path.join('sample', 'path', 'AccountController.cls'), path.join('another', 'path')]);
    filesDifferStub.returns(true);

    const results = differ.diffComponents(sampleComponent, sampleComponent);

    expect(walkContetStub.callCount).to.equal(2);
    expect(filesDifferStub.callCount).to.equal(3);
    expect(results).to.have.deep.members([{
      projectPath: path.join('sample', 'path', 'AccountController.cls'),
      cachePath: path.join('sample', 'path', 'AccountController.cls')
    },
    {
      projectPath: path.join('another', 'path'),
      cachePath: path.join('another', 'path')
    },
    {
      projectPath: 'AccountController.cls-meta.xml',
      cachePath: 'AccountController.cls-meta.xml'
    }]);
  });

  it('Should return nothing if there are no differences', () => {
    walkContetStub.returns([path.join('sample', 'path', 'AccountController.cls'), path.join('another', 'path')]);
    filesDifferStub.returns(false);

    const results = differ.diffComponents(sampleComponent, sampleComponent);

    expect(walkContetStub.callCount).to.equal(2);
    expect(filesDifferStub.callCount).to.equal(3);
    expect(results).to.deep.equal([]);
  })
});