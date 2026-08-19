/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { defaultSoqlBuilderLabels, SoqlBuilderApp } from '@salesforce/soql-builder-ui';
import { HttpSoqlBuilderHost } from './httpSoqlBuilderHost.js';

const main = document.querySelector('#main');
if (!main) {
  throw new Error('The standalone SOQL Builder requires a #main mount point.');
}

const app = new SoqlBuilderApp();
app.host = new HttpSoqlBuilderHost();
app.labels = {
  ...defaultSoqlBuilderLabels,
  spikeDescription:
    'Standalone SOQL Builder example. The browser consumes @salesforce/soql-builder-ui while a local Node server supplies org metadata through @salesforce/core.'
};
main.append(app);
