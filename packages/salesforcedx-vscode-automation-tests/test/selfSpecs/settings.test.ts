/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { step } from 'mocha-steps';
import * as utilities from 'salesforcedx-vscode-automation-tests-redhat/test/utilities';

describe('Settings', async () => {
  step('Test Settings', async () => {
    await utilities.disableBooleanSetting('editor.find.addExtraSpaceOnTop', 'user');
    await utilities.pause(utilities.Duration.seconds(5));
    await utilities.enableBooleanSetting('editor.find.addExtraSpaceOnTop', 'user');
    await utilities.pause(utilities.Duration.seconds(5));
  });
});
