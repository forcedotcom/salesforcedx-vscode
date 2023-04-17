/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import { ForceSourceDeleteExecutor } from '../../../../src/commands';

describe('Force Source Delete', () => {
  let isSourceTracked: boolean;
  const sourcePath: string = path.join('example', 'path');
  it('Should build the source delete command with --tracksource flag when connected to a source-tracked org', () => {
    isSourceTracked = true;
    const executor = new ForceSourceDeleteExecutor(isSourceTracked);
    const sourceDeleteCommand = executor.build({ filePath: sourcePath });
    expect(sourceDeleteCommand.toCommand()).toEqual(
      `sfdx force:source:delete --sourcepath ${sourcePath} --noprompt --tracksource`
    );
  });
  it('Should build the source delete command without --tracksource flag when connected to a non-source-tracked org', () => {
    isSourceTracked = false;
    const executor = new ForceSourceDeleteExecutor(isSourceTracked);
    const sourceDeleteCommand = executor.build({ filePath: sourcePath });
    expect(sourceDeleteCommand.toCommand()).toEqual(
      `sfdx force:source:delete --sourcepath ${sourcePath} --noprompt`
    );
  });
});
