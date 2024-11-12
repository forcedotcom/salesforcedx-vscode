/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// tslint:disable:no-unused-expression

import { expect } from 'chai';
import * as path from 'path';
import * as shell from 'shelljs';

describe('Apex LSP Jar Contents', () => {
  it('should not contain perm-guarded apex classes', () => {
    shell.config.execPath = process.execPath;
    const apexJarPath = path.join(__dirname, '..', '..', 'apex-jorje-lsp.jar');
    const stdout = shell.exec(`jar tvf ${apexJarPath}`).stdout;

    expect(stdout.includes('AuraException.cls')).to.be.false;
    expect(stdout.includes('AuraHandledException.cls')).to.be.false;
    expect(stdout.includes('Blacktab.cls')).to.be.false;
    expect(stdout.includes('InstallContext.cls')).to.be.false;
    expect(stdout.includes('InstallHandler.cls')).to.be.false;
    expect(stdout.includes('UninstallContext.cls')).to.be.false;
    expect(stdout.includes('UninstallHandler.cls')).to.be.false;
    expect(stdout.includes('BusOp.cls')).to.be.false;
    expect(stdout.includes('AppExchange.cls')).to.be.false;
    expect(stdout.includes('ApplicationReadWriteMode.cls')).to.be.false;
    expect(stdout.includes('CollectSimilarCasesData.cls')).to.be.false;
    expect(stdout.includes('FfxPortalData.cls')).to.be.false;
    expect(stdout.includes('ProductSecurity.cls')).to.be.false;
    expect(stdout.includes('LegalOrgOps.cls')).to.be.false;
    expect(stdout.includes('Org62Ops.cls')).to.be.false;
    expect(stdout.includes('OrgCSOps.cls')).to.be.false;
    expect(stdout.includes('GusOps.cls')).to.be.false;
    expect(stdout.includes('BlackTabFramework.cls')).to.be.false;
    expect(stdout.includes('SfdcOps.cls')).to.be.false;
    expect(stdout.includes('Org62LEXFeedbackController.cls')).to.be.false;
    expect(stdout.includes('TrailblazerIdentityAdditionalInfo.cls')).to.be.false;
    expect(stdout.includes('TrailblazerIdentityInfo.cls')).to.be.false;
    expect(stdout.includes('TrailblazerIdentityInfoWrapper.cls')).to.be.false;
    expect(stdout.includes('TrailblazerIdentityArrayLengthMismatchException.cls')).to.be.false;
    expect(stdout.includes('ChatterGroupSummaryPage.cls')).to.be.false;
    expect(stdout.includes('FeedItemInputAttachmentType.cls')).to.be.false;
  });
});
