/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as path from 'path';

import { ForceSourceDeployManifestExecutor } from '../../../src/commands';

import { nls } from '../../../src/messages';

describe('Force Source Deploy Using Manifest Option', () => {
  it('Should build the source deploy command', () => {
    const manifestPath = path.join('path', 'to', 'manifest', 'package.xml');
    const sourceDeploy = new ForceSourceDeployManifestExecutor();
    const sourceDeployCommand = sourceDeploy.build(manifestPath);
    expect(sourceDeployCommand.toCommand()).to.equal(
      `sfdx force:source:deploy --manifest ${manifestPath} --json --loglevel fatal`
    );
    expect(sourceDeployCommand.description).to.equal(
      nls.localize('force_source_deploy_text')
    );
  });
});
