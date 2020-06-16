/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { RegistryAccess } from '@salesforce/source-deploy-retrieve';
import { expect } from 'chai';
import * as path from 'path';
import { createSandbox, SinonSandbox } from 'sinon';
import { ForceSourceDeploySourcePathExecutor } from '../../../src/commands/forceSourceDeploySourcePath';
import { nls } from '../../../src/messages';
import sinon = require('sinon');

describe('Force Source Deploy Using Sourcepath Option', () => {
  let sandboxStub: SinonSandbox;
  let registryStub: sinon.SinonStub;
  beforeEach(() => {
    sandboxStub = createSandbox();
    registryStub = sandboxStub.stub(
      RegistryAccess.prototype,
      'getComponentsFromPath'
    );
  });

  afterEach(() => {
    sandboxStub.restore();
  });

  it('Should build the source deploy command for', () => {
    const sourcePath = path.join('path', 'to', 'sourceFile');
    const sourceDeploy = new ForceSourceDeploySourcePathExecutor();
    const sourceDeployCommand = sourceDeploy.build(sourcePath);

    expect(sourceDeployCommand.toCommand()).to.equal(
      `sfdx force:source:deploy --sourcepath ${sourcePath} --json --loglevel fatal`
    );
    expect(sourceDeployCommand.description).to.equal(
      nls.localize('force_source_deploy_text')
    );
  });
});
