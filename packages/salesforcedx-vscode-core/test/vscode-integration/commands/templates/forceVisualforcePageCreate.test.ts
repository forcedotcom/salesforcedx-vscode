/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as path from 'path';
import { ForceVisualForcePageCreateExecutor } from '../../../../src/commands/templates/forceVisualforcePageCreate';
import { nls } from '../../../../src/messages';

// tslint:disable:no-unused-expression
describe('Force Visualforce Page Create', () => {
  it('Should build the Visualforce page create command', async () => {
    const visualforcePageCreate = new ForceVisualForcePageCreateExecutor();
    const outputDirPath = path.join('force-app', 'main', 'default', 'pages');
    const fileName = 'myVFPage';
    const vfPageCreateCommand = visualforcePageCreate.build({
      fileName,
      outputdir: outputDirPath
    });
    expect(vfPageCreateCommand.toCommand()).to.equal(
      `sfdx force:visualforce:page:create --pagename ${fileName} --label ${fileName} --outputdir ${outputDirPath}`
    );
    expect(vfPageCreateCommand.description).to.equal(
      nls.localize('force_visualforce_page_create_text')
    );
    expect(visualforcePageCreate.getDefaultDirectory()).to.equal('pages');
    expect(visualforcePageCreate.getFileExtension()).to.equal('.page');
    expect(
      visualforcePageCreate
        .getSourcePathStrategy()
        .getPathToSource(outputDirPath, fileName, '.page')
    ).to.equal(path.join(outputDirPath, `${fileName}.page`));
  });
});
