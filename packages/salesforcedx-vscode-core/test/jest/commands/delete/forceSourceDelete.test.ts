/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ForceSourceDeleteExecutor } from "../../../../src/commands";
import * as path from 'path';

describe('Force Source Delete', () => {
  it('Should build the source delete command', () => {
    const executor = new ForceSourceDeleteExecutor();
    const sourcePath = path.join('example', 'path');
    const sourceDeleteCommand = executor.build({ filePath: sourcePath });
    expect(sourceDeleteCommand.toCommand()).toEqual(
      `sfdx force:source:delete --sourcepath ${sourcePath} --noprompt --tracksource`
    );
  });

  it('Should not build the source delete command without --tracksource flag', () => {
    const executor = new ForceSourceDeleteExecutor();
    const sourcePath = path.join('example', 'path');
    const sourceDeleteCommand = executor.build({ filePath: sourcePath });
    expect(sourceDeleteCommand.toCommand()).not.toEqual(
      `sfdx force:source:delete --sourcepath ${sourcePath} --noprompt`
    );
  });
});