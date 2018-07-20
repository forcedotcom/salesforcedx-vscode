/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as path from 'path';

import { ForceSourceDeployExecutor } from './../../src/commands/forceSourceDeploy';
import { FileType } from './../../src/commands/forceSourceRetrieve';

import { nls } from '../../src/messages';

describe('Force Source Deploy with Manifest Option', () => {
  it('Should build the source deploy command', () => {
    const manifestPath = path.join('path', 'to', 'manifest', 'package.xml');
    const sourceDeploy = new ForceSourceDeployExecutor();
    const sourceDeployCommand = sourceDeploy.build({
      filePath: manifestPath,
      type: FileType.Manifest
    });
    expect(sourceDeployCommand.toCommand()).to.equal(
      `sfdx force:source:deploy --manifest ${manifestPath}`
    );
    expect(sourceDeployCommand.description).to.equal(
      nls.localize('force_source_deploy_text')
    );
  });
});

describe('Force Source Deploy with Sourcepath Option', () => {
  it('Should build the source deploy command', () => {
    const sourcePath = path.join('path', 'to', 'sourceFile');
    const sourceDeploy = new ForceSourceDeployExecutor();
    const sourceDeployCommand = sourceDeploy.build({
      filePath: sourcePath,
      type: FileType.Source
    });
    expect(sourceDeployCommand.toCommand()).to.equal(
      `sfdx force:source:deploy --sourcepath ${sourcePath}`
    );
    expect(sourceDeployCommand.description).to.equal(
      nls.localize('force_source_deploy_text')
    );
  });
});
