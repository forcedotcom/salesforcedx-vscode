/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as path from 'path';

import { ForceSourceDiffExecutor } from '../../../src/commands/forceSourceDiff';

import { nls } from '../../../src/messages';

describe('Force Source Diff', () => {
  it('Should build the source diff command', () => {
    const apexTestClassPath = path.join('path', 'to', 'apex', 'testApex.cls');
    const sourceDiff = new ForceSourceDiffExecutor();
    const sourceDiffCommand = sourceDiff.build(apexTestClassPath);
    expect(sourceDiffCommand.toCommand()).to.equal(
      `sfdx force:source:diff --sourcepath ${apexTestClassPath} --json --loglevel fatal`
    );
    expect(sourceDiffCommand.description).to.equal(
      nls.localize('force_source_diff_text')
    );
  });
});
