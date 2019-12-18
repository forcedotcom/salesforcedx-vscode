/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as path from 'path';
import { SinonStub, stub } from 'sinon';
import { ForceAnalyticsTemplateCreateExecutor } from '../../../../src/commands/templates/forceAnalyticsTemplateCreate';
import { nls } from '../../../../src/messages';
import { SfdxCoreSettings } from '../../../../src/settings/sfdxCoreSettings';

// tslint:disable:no-unused-expression
describe('Force Analytics Template Create', () => {
  let settings: SinonStub;

  beforeEach(() => {
    settings = stub(SfdxCoreSettings.prototype, 'getInternalDev');
  });

  afterEach(() => {
    settings.restore();
  });

  it('Should build the analytics template create command', async () => {
    settings.returns(false);
    const waveTemplateCreate = new ForceAnalyticsTemplateCreateExecutor();
    const outputDirPath = path.join(
      'force-app',
      'main',
      'default',
      'waveTemplates'
    );
    const sampleTemplateName = 'analyticsTemplate';

    const waveTemplateCreateCommand = waveTemplateCreate.build({
      outputdir: outputDirPath,
      fileName: '',
      templateName: sampleTemplateName
    });
    expect(waveTemplateCreateCommand.toCommand()).to.equal(
      `sfdx force:analytics:template:create --outputdir ${outputDirPath} --templatename ${sampleTemplateName}`
    );
    expect(waveTemplateCreateCommand.description).to.equal(
      nls.localize('force_analytics_template_create_text')
    );
    expect(waveTemplateCreate.getDefaultDirectory()).to.equal('waveTemplates');
    expect(
      waveTemplateCreate.sourcePathStrategy.getPathToSource(
        path.join(outputDirPath, sampleTemplateName, 'dashboards'),
        sampleTemplateName,
        'Dashboard.json'
      )
    ).to.equal(
      path.join(
        outputDirPath,
        sampleTemplateName,
        'dashboards',
        `${sampleTemplateName}Dashboard.json`
      )
    );
  });
});
