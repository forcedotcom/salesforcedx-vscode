/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { EXTENSION_NAME } from '../../src/constants';

describe('Salesforce Metadata Extension', () => {
  it('should have correct extension name', () => {
    expect(EXTENSION_NAME).toBe('salesforcedx-vscode-metadata');
  });
});
