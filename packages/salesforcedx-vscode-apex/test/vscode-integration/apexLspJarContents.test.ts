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
    const permGuardedClasses = ['AuraException.cls', 'AuraHandledException.cls', 'Blacktab.cls', 'InstallContext.cls', 'InstallHandler.cls', 'UninstallContext.cls', 
    'UninstallHandler.cls', 'BusOp.cls', 'AppExchange.cls', 'ApplicationReadWriteMode.cls', 'CollectSimilarCasesData.cls', 'FfxPortalData.cls', 'ProductSecurity.cls',
    'LegalOrgOps.cls', 'Org62Ops.cls', 'OrgCSOps.cls', 'GusOps.cls', 'BlackTabFramework.cls', 'SfdcOps.cls', 'Org62LEXFeedbackController.cls', 'TrailblazerIdentityAdditionalInfo.cls',
    'TrailblazerIdentityInfo.cls', 'TrailblazerIdentityInfoWrapper.cls', 'TrailblazerIdentityArrayLengthMismatchException.cls', 'ChatterGroupSummaryPage.cls',
    'FeedItemInputAttachmentType.cls'];
    const stdout = shell.exec(`jar tvf ${apexJarPath}`).stdout;
    expect(
      permGuardedClasses.some(permGuardedClass => stdout.includes(permGuardedClass))
    ).to.be.true;
  });
});
