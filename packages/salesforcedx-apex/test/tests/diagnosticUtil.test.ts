/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { nls } from '../../src/i18n';
import { formatTestErrors } from '../../src/tests/diagnosticUtil';

describe('Format Test Errors', () => {
  it('should add formatted text to all invalid permissions errors', async () => {
    const invalidApexMsg = "nestedException:\n\t sObject type 'ApexClass' is not supported.";
    const invalidApexErr = new Error(invalidApexMsg);
    const formattedApex = formatTestErrors(invalidApexErr);
    expect(formattedApex.message).toContain(nls.localize('invalidsObjectErr', ['ApexClass', invalidApexMsg]));
  });

  it('should return unchanged error if not of type invalid permissions', async () => {
    const accessTokenErr = new Error();
    accessTokenErr.name = 'Access Token Error';
    const unchangedTokenErr = formatTestErrors(accessTokenErr);
    expect(unchangedTokenErr.message).toBe(accessTokenErr.message);
    expect(unchangedTokenErr.name).toBe(accessTokenErr.name);
    expect(unchangedTokenErr.stack).toBe(accessTokenErr.stack);
  });

  it('should preserve original name and stack values after formatting error', async () => {
    const invalidPkgMsg = "nestedException:\n\t sObject type 'PackageLicense' is not supported.";
    const invalidPkgErr = new Error(invalidPkgMsg);
    invalidPkgErr.name = 'INVALIDTYPE';
    invalidPkgErr.stack = 'STACKTRACE';
    const formattedPkg = formatTestErrors(invalidPkgErr);
    expect(formattedPkg.message).toContain(nls.localize('invalidsObjectErr', ['PackageLicense', invalidPkgMsg]));
    expect(formattedPkg.name).toBe(invalidPkgErr.name);
    expect(formattedPkg.stack).toBe(invalidPkgErr.stack);
  });
});
