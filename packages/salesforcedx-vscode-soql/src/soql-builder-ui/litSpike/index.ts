/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import './litSpikeApp';
import { installStandaloneVscodeApi } from './standaloneVscodeApi';

installStandaloneVscodeApi();

const main = document.querySelector('#main');
if (!main) {
  throw new Error('SOQL Builder Lit spike requires a #main mount point.');
}

main.append(document.createElement('soql-builder-lit-spike'));
