/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { join } from 'path';

export const ICONS = {
  LIGHT_BLUE_BUTTON: join('resources', 'light', 'testNotRun.svg'),
  LIGHT_RED_BUTTON: join('resources', 'light', 'testFail.svg'),
  LIGHT_GREEN_BUTTON: join('resources', 'light', 'testPass.svg'),
  LIGHT_ORANGE_BUTTON: join('resources', 'light', 'testSkip.svg'),
  DARK_BLUE_BUTTON: join('resources', 'dark', 'testNotRun.svg'),
  DARK_RED_BUTTON: join('resources', 'dark', 'testFail.svg'),
  DARK_GREEN_BUTTON: join('resources', 'dark', 'testPass.svg'),
  DARK_ORANGE_BUTTON: join('resources', 'dark', 'testSkip.svg')
};

export type iconKey = keyof typeof ICONS;
export enum IconsEnum {
  LIGHT_BLUE_BUTTON = 'LIGHT_BLUE_BUTTON',
  LIGHT_RED_BUTTON = 'LIGHT_RED_BUTTON',
  LIGHT_ORANGE_BUTTON = 'LIGHT_ORANGE_BUTTON',
  LIGHT_GREEN_BUTTON = 'LIGHT_GREEN_BUTTON',
  DARK_BLUE_BUTTON = 'DARK_BLUE_BUTTON',
  DARK_RED_BUTTON = 'DARK_RED_BUTTON',
  DARK_GREEN_BUTTON = 'DARK_GREEN_BUTTON',
  DARK_ORANGE_BUTTON = 'DARK_ORANGE_BUTTON'
}
