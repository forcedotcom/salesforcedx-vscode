/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export { showDemoMode } from './demoModeDecorator';
export { disposeTraceFlagExpiration, showTraceFlagExpiration } from './traceflagTimeDecorator';
import { showOrg } from './scratchOrgDecorator';

export const decorators = {
  showOrg
} as const;
