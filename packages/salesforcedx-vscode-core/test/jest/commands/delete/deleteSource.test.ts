/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';
import { DeleteSourceExecutor } from '../../../../src/commands';

describe('Project Delete Source', () => {
  let isSourceTracked: boolean;
  const sourcePath: string = path.join('example', 'path');

  it('Should build the delete source command with --track-source flag when connected to a source-tracked org', () => {
    isSourceTracked = true;
    const executor = new DeleteSourceExecutor(isSourceTracked);
    const sourceDeleteCommand = executor.build({ filePath: sourcePath });
    expect(sourceDeleteCommand.toCommand()).toEqual(
      `sf project:delete:source --source-dir ${sourcePath} --no-prompt --track-source`
    );
  });

  it('Should build the delete source command without --track-source flag when connected to a non-source-tracked org', () => {
    isSourceTracked = false;
    const executor = new DeleteSourceExecutor(isSourceTracked);
    const sourceDeleteCommand = executor.build({ filePath: sourcePath });
    expect(sourceDeleteCommand.toCommand()).toEqual(`sf project:delete:source --source-dir ${sourcePath} --no-prompt`);
  });
});
