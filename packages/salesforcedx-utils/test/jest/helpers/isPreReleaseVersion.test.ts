/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { isPreReleaseVersion } from '../../../src/helpers/isPreReleaseVersion';

describe('isPreReleaseVersion', () => {
  it.each(['67.19.0', '67.19.3', '1.1.0'])('treats odd minor %s as pre-release', version =>
    expect(isPreReleaseVersion(version)).toBe(true)
  );

  it.each(['67.20.0', '67.20.5', '1.0.0'])('treats even minor %s as stable', version =>
    expect(isPreReleaseVersion(version)).toBe(false)
  );

  it.each(['67', '', 'not.a.version'])('treats unparseable minor %s as stable', version =>
    expect(isPreReleaseVersion(version)).toBe(false)
  );
});
