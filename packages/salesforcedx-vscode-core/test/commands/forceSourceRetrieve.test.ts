/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'path';

import {
  FileType,
  ForceSourceRetrieveExecutor
} from './../../src/commands/forceSourceRetrieve';

import { expect } from 'chai';
import { nls } from '../../src/messages';

describe('Force Source Retrieve with Sourcepath Option', () => {
  it('Should build the source retrieve command', () => {
    const sourcePath = path.join('path', 'to', 'manifest', 'package.xml');
    const sourceRetrieve = new ForceSourceRetrieveExecutor();
    const sourceRetrieveCommand = sourceRetrieve.build({
      filePath: sourcePath,
      type: FileType.Manifest
    });
    expect(sourceRetrieveCommand.toCommand()).to.equal(
      `sfdx force:source:retrieve --manifest ${sourcePath}`
    );
    expect(sourceRetrieveCommand.description).to.equal(
      nls.localize('force_source_retrieve_text')
    );
  });
});
