/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as path from 'path';
import { ForceSourceRetrieveManifestExecutor } from '../../../src/commands';
import { nls } from '../../../src/messages';

describe('Force Source Retrieve with Manifest Option', () => {
  it('Should build the source retrieve command', () => {
    const manifestPath = path.join('path', 'to', 'manifest', 'package.xml');
    const sourceRetrieve = new ForceSourceRetrieveManifestExecutor();
    const sourceRetrieveCommand = sourceRetrieve.build(manifestPath);
    expect(sourceRetrieveCommand.toCommand()).to.equal(
      `sfdx force:source:retrieve --manifest ${manifestPath}`
    );
    expect(sourceRetrieveCommand.description).to.equal(
      nls.localize('force_source_retrieve_text')
    );
  });
});
