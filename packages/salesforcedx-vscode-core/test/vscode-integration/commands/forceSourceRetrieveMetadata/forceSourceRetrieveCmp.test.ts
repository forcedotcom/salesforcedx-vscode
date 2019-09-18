/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LocalComponent } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { expect } from 'chai';
import { RetrieveDescriber } from '../../../../src/commands/forceSourceRetrieveCmp';
import { ForceSourceRetrieveExecutor } from '../../../../src/commands/forceSourceRetrieveCmp/forceSourceRetrieveCmp';

class TestDescriber implements RetrieveDescriber {
  public buildMetadataArg(data?: LocalComponent[]): string {
    return data ? `${data[0].type}:${data[0].fileName}` : 'TestType:Test1';
  }

  public gatherOutputLocations(): Promise<LocalComponent[]> {
    throw new Error('Method not implemented.');
  }
}

describe('Force Source Retrieve', () => {
  const forceSourceRetrieveExec = new ForceSourceRetrieveExecutor(
    new TestDescriber()
  );
  it('Should build source retrieve command', async () => {
    const forceSourceRetrieveCmd = forceSourceRetrieveExec.build();
    expect(forceSourceRetrieveCmd.toCommand()).to.equal(
      `sfdx force:source:retrieve -m TestType:Test1`
    );
  });

  it('Should pass optional data to describer', () => {
    const data = [{ fileName: 'Test2', outputdir: '', type: 'TestType2' }];
    const forceSourceRetrieveCmd = forceSourceRetrieveExec.build(data);
    expect(forceSourceRetrieveCmd.toCommand()).to.equal(
      `sfdx force:source:retrieve -m TestType2:Test2`
    );
  });
});
