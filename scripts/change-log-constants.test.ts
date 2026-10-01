/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/// <reference types="jest" />
/// <reference types="node" />

import { RELEASE_REGEX } from './change-log-constants';

describe('RELEASE_REGEX', () => {
  test.each(['origin/release/v66.5.4', 'origin/release/v66.12.4', 'origin/release/v61.1.202406191959'])(
    'accepts %s',
    releaseBranch => {
      expect(RELEASE_REGEX.test(releaseBranch)).toBe(true);
    }
  );

  test.each(['origin/release/v66.5.4; echo exposed', 'origin/release/v66.5.4 trailing-text'])(
    'rejects %s',
    releaseBranch => {
      expect(RELEASE_REGEX.test(releaseBranch)).toBe(false);
    }
  );
});
