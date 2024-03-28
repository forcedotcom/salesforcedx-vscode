/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SalesforceCoreSettings } from './salesforceCoreSettings';

export const salesforceCoreSettings = SalesforceCoreSettings.getInstance();
export {
  DeployQueue,
  registerPushOrDeployOnSave,
  pathIsInPackageDirectory,
  fileShouldNotBeDeployed
} from './pushOrDeployOnSave';
