/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'path';

const extensionPath = path.join(__filename, '..', '..', '..', '..', '..');

export const LIGHT_BLUE_BUTTON = path.join(
  extensionPath,
  'resources',
  'light',
  'testNotRun.svg'
);

export const LIGHT_RED_BUTTON = path.join(
  extensionPath,
  'resources',
  'light',
  'testFail.svg'
);
export const LIGHT_GREEN_BUTTON = path.join(
  extensionPath,
  'resources',
  'light',
  'testPass.svg'
);
export const LIGHT_ORANGE_BUTTON = path.join(
  extensionPath,
  'resources',
  'light',
  'testSkip.svg'
);

export const DARK_BLUE_BUTTON = path.join(
  extensionPath,
  'resources',
  'dark',
  'testNotRun.svg'
);
export const DARK_RED_BUTTON = path.join(
  extensionPath,
  'resources',
  'dark',
  'testFail.svg'
);
export const DARK_GREEN_BUTTON = path.join(
  extensionPath,
  'resources',
  'dark',
  'testPass.svg'
);
export const DARK_ORANGE_BUTTON = path.join(
  extensionPath,
  'resources',
  'dark',
  'testSkip.svg'
);
